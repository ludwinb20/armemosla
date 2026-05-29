import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import PlayerLoadingView from './lottie/PlayerLoadingView';
import { useTheme } from '../contexts/ThemeContext';
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
  const colors = useThemeColors();
  useTheme();
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
      <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
        <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Buscar rival para esta cancha</Text>
            <TouchableOpacity onPress={handleClose} disabled={publicando}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <PlayerLoadingView message="Cargando datos..." compact style={styles.loadingWrap} />
          ) : (
            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Reserva</Text>
                {reservaFija && reservaSeleccionada ? (
                  <View style={[styles.reservaReadonly, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.reservaReadonlyText, { color: colors.text }]}>
                      {(reservaSeleccionada.cancha as { nombre?: string })?.nombre || 'Cancha'} —{' '}
                      {formatFechaHora(reservaSeleccionada.fecha_hora).fecha}{' '}
                      {formatFechaHora(reservaSeleccionada.fecha_hora).hora}
                    </Text>
                  </View>
                ) : reservasPendientes.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No tienes reservas pendientes
                  </Text>
                ) : (
                  <ScrollView style={styles.reservasList} nestedScrollEnabled>
                    {reservasPendientes.map((reserva) => {
                      const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
                      const cancha = reserva.cancha as { nombre?: string } | undefined;
                      return (
                        <TouchableOpacity
                          key={reserva.id}
                          style={[
                            styles.option,
                            {
                              backgroundColor: reservaId === reserva.id ? Colors.primary + '20' : colors.surface,
                              borderColor: reservaId === reserva.id ? Colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => setReservaId(reserva.id)}
                        >
                          <Text style={[styles.optionText, { color: colors.text }]}>
                            {cancha?.nombre || 'Cancha'} — {fecha} {hora}
                          </Text>
                          {reservaId === reserva.id && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Equipo</Text>
                {equipos.length === 0 ? (
                  <View style={[styles.noEquipoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      Necesitás un equipo para buscar rival.
                    </Text>
                    <TouchableOpacity
                      style={[styles.perfilBtn, { backgroundColor: Colors.primary }]}
                      onPress={() => {
                        handleClose();
                        router.push('/(tabs)/perfil');
                      }}
                    >
                      <Text style={styles.perfilBtnText}>Ir a Perfil</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView style={styles.equiposList} nestedScrollEnabled>
                    {equipos.map((equipo) => (
                      <TouchableOpacity
                        key={equipo.id}
                        style={[
                          styles.option,
                          {
                            backgroundColor: equipoId === equipo.id ? Colors.primary + '20' : colors.surface,
                            borderColor: equipoId === equipo.id ? Colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setEquipoId(equipo.id)}
                      >
                        <Text style={[styles.optionText, { color: colors.text }]}>{equipo.nombre}</Text>
                        {equipoId === equipo.id && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Jugadores necesarios</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  value={jugadoresNecesarios.toString()}
                  onChangeText={(text) => setJugadoresNecesarios(parseInt(text, 10) || 5)}
                  placeholder="5"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Publicamos tu partido para que otros equipos te soliciten jugar. También buscamos rivales compatibles
                automáticamente.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
          )}

          {!loadingData && equipos.length > 0 && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                onPress={handleClose}
                disabled={publicando}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonSave,
                  {
                    backgroundColor:
                      publicando || !reservaId || !equipoId ? colors.borderLight : Colors.primary,
                  },
                ]}
                onPress={handlePublicar}
                disabled={publicando || !reservaId || !equipoId}
              >
                {publicando ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Publicar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modalSheetOuter: { flex: 1, justifyContent: 'center' },
  modalCard: {
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  modalBodyContent: { padding: Spacing.md },
  loadingWrap: { padding: Spacing.xxl, alignItems: 'center' },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, marginBottom: Spacing.xs },
  reservasList: { maxHeight: 140 },
  equiposList: { maxHeight: 120 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  optionText: { fontSize: Typography.fontSize.sm, flex: 1 },
  reservaReadonly: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reservaReadonlyText: { fontSize: Typography.fontSize.sm },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  hint: { fontSize: Typography.fontSize.xs, lineHeight: 18 },
  emptyText: { fontSize: Typography.fontSize.sm },
  noEquipoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  perfilBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  perfilBtnText: { color: Colors.textInverse, fontWeight: Typography.fontWeight.semibold },
  errorText: { color: Colors.error, fontSize: Typography.fontSize.sm, marginTop: Spacing.sm },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonCancel: { borderWidth: 1, borderColor: Colors.border },
  modalButtonSave: {},
  modalButtonText: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  modalButtonTextSave: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
});
