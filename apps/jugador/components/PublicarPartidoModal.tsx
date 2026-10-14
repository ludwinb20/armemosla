import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Spacing } from '../constants/theme';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { Text, Button, Input, Surface } from '@/components/ui';
import { cn } from '@/lib/cn';
import PlayerLoadingView from './lottie/PlayerLoadingView';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../lib/rnModalPresets';
import { obtenerReservasJugador, ReservaWithRelations } from '../lib/reservas';
import { obtenerEquiposJugador, EquipoWithMembers } from '../lib/equipos';
import { publicarReservaBuscarRival } from '../lib/partidos';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (matchesFound: number) => void;
  /** Si se indica, la reserva queda fija (solo lectura). */
  reservaIdPrefilled?: string;
};

function formatFechaHora(fechaHora: string) {
  const fecha = new Date(fechaHora);
  return {
    fecha: fecha.toLocaleDateString('es-HN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    hora: fecha.toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export default function PublicarPartidoModal({
  visible,
  onClose,
  onSuccess,
  reservaIdPrefilled,
}: Props) {
  const { colors } = useGlassTheme();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();

  const [loadingData, setLoadingData] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [equipos, setEquipos] = useState<EquipoWithMembers[]>([]);
  const [reservaId, setReservaId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [jugadoresNecesarios, setJugadoresNecesarios] = useState(5);

  const reservaFija = Boolean(reservaIdPrefilled);
  const reservasPendientes = reservas.filter((r) => r.estado === 'pendiente');
  const reservaSeleccionada = reservasPendientes.find((r) => r.id === reservaId);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);
      const [reservasData, equiposData] = await Promise.all([
        obtenerReservasJugador(),
        obtenerEquiposJugador(),
      ]);
      setReservas(reservasData);
      setEquipos(equiposData);
    } catch (e) {
      console.error(e);
      setError('No se pudieron cargar tus datos');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadData();
  }, [visible, loadData]);

  useEffect(() => {
    if (!visible) return;
    if (reservaIdPrefilled) {
      setReservaId(reservaIdPrefilled);
    }
  }, [visible, reservaIdPrefilled]);

  useEffect(() => {
    if (!visible) return;
    if (equipos.length === 1) {
      setEquipoId(equipos[0].id);
    }
  }, [visible, equipos]);

  useEffect(() => {
    if (!reservaId) return;
    const reserva = reservas.find((r) => r.id === reservaId);
    const jugadores = (reserva?.cancha as { jugadores_por_equipo?: number } | undefined)?.jugadores_por_equipo;
    if (jugadores && jugadores > 0) {
      setJugadoresNecesarios(jugadores);
    }
  }, [reservaId, reservas]);

  const handleClose = () => {
    if (publicando) return;
    setReservaId('');
    setEquipoId('');
    setJugadoresNecesarios(5);
    setError(null);
    onClose();
  };

  const handlePublicar = async () => {
    if (!reservaId || !equipoId) return;
    try {
      setPublicando(true);
      setError(null);
      const { matchesFound } = await publicarReservaBuscarRival(reservaId, equipoId, jugadoresNecesarios);
      onSuccess?.(matchesFound);
      handleClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo publicar el partido';
      setError(msg);
    } finally {
      setPublicando(false);
    }
  };

  return (
    <RNModal
      {...rBackdrop}
      {...rModalAnimLeft}
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      avoidKeyboard
      style={rCenter}
    >
      <SafeAreaView className="flex-1 justify-center" edges={['top', 'bottom']}>
        <Surface
          variant="glass"
          className="mx-md overflow-hidden rounded-xl"
          style={{ maxHeight: modalMaxHeight }}
        >
          <View className="flex-row items-center justify-between p-md border-b border-border-subtle dark:border-border-subtle-dark">
            <Text variant="h4" className="flex-1 mr-sm">
              Buscar rival para esta cancha
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={publicando}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <PlayerLoadingView message="Cargando datos..." compact style={{ padding: Spacing.xxl, alignItems: 'center' }} />
          ) : (
            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-md"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View className="mb-md">
                <Text variant="label" className="mb-xs">
                  Reserva
                </Text>
                {reservaFija && reservaSeleccionada ? (
                  <Surface variant="solid" className="p-md">
                    <Text variant="caption">
                      {(reservaSeleccionada.cancha as { nombre?: string })?.nombre || 'Cancha'} —{' '}
                      {formatFechaHora(reservaSeleccionada.fecha_hora).fecha}{' '}
                      {formatFechaHora(reservaSeleccionada.fecha_hora).hora}
                    </Text>
                  </Surface>
                ) : reservasPendientes.length === 0 ? (
                  <Text variant="caption">No tienes reservas pendientes</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                    {reservasPendientes.map((reserva) => {
                      const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
                      const cancha = reserva.cancha as { nombre?: string } | undefined;
                      const selected = reservaId === reserva.id;
                      return (
                        <Pressable
                          key={reserva.id}
                          className={cn(
                            'flex-row items-center justify-between p-md rounded-lg border mb-sm',
                            selected ? 'bg-primary/20 border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
                          )}
                          onPress={() => setReservaId(reserva.id)}
                        >
                          <Text variant="caption" className="flex-1">
                            {cancha?.nombre || 'Cancha'} — {fecha} {hora}
                          </Text>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View className="mb-md">
                <Text variant="label" className="mb-xs">
                  Equipo
                </Text>
                {equipos.length === 0 ? (
                  <Surface variant="solid" className="p-md gap-sm">
                    <Text variant="caption">Necesitás un equipo para buscar rival.</Text>
                    <Button
                      size="sm"
                      className="self-start"
                      onPress={() => {
                        handleClose();
                        router.push('/(tabs)/perfil');
                      }}
                    >
                      Ir a Perfil
                    </Button>
                  </Surface>
                ) : (
                  <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                    {equipos.map((equipo) => {
                      const selected = equipoId === equipo.id;
                      return (
                        <Pressable
                          key={equipo.id}
                          className={cn(
                            'flex-row items-center justify-between p-md rounded-lg border mb-sm',
                            selected ? 'bg-primary/20 border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
                          )}
                          onPress={() => setEquipoId(equipo.id)}
                        >
                          <Text variant="caption" className="flex-1">
                            {equipo.nombre}
                          </Text>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View className="mb-md">
                <Input
                  label="Jugadores necesarios"
                  value={jugadoresNecesarios.toString()}
                  onChangeText={(text) => setJugadoresNecesarios(parseInt(text, 10) || 5)}
                  placeholder="5"
                  keyboardType="numeric"
                />
              </View>

              <Text variant="caption" className="leading-[18px]">
                Publicamos tu partido para que otros equipos te soliciten jugar. También buscamos rivales compatibles
                automáticamente.
              </Text>

              {error ? (
                <Text className="text-sm text-error mt-sm">{error}</Text>
              ) : null}
            </ScrollView>
          )}

          {!loadingData && equipos.length > 0 && (
            <View className="flex-row gap-sm p-md border-t border-border-subtle dark:border-border-subtle-dark">
              <Button variant="outline" className="flex-1" onPress={handleClose} disabled={publicando}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onPress={handlePublicar}
                disabled={publicando || !reservaId || !equipoId}
                loading={publicando}
              >
                Publicar
              </Button>
            </View>
          )}
        </Surface>
      </SafeAreaView>
    </RNModal>
  );
}
