import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Pressable,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import {
  obtenerPartidosAbiertos,
  enviarSolicitudPartido,
  filterPartidosPorRangoHorario,
  PartidoAbiertoWithRelations,
} from '../../../lib/partidos';
import type { FiltrosPartidos } from '../../../lib/partidos';
import { obtenerEquiposJugador, EquipoWithMembers } from '../../../lib/equipos';
import { useCustomAlert } from '../../../hooks/useCustomAlert';
import CustomAlert from '../../../components/CustomAlert';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
  rModalAnimCenter,
} from '../../../lib/rnModalPresets';
import PartidosMapa, { partidosToMapMarkers } from '../../../components/PartidosMapa';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../../components/lottie/PlayerEmptyState';
import FechaHoraNativePickers from '../../../components/FechaHoraNativePickers';
import HourOnlyTimePicker from '../../../components/HourOnlyTimePicker';
import { formatLocalDateYMD } from '../../../lib/fechaHora';
import { Screen, Text, Button, Input, Surface, DialogSheet } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/cn';

type FiltroPicker = 'fechaDesde' | 'fechaHasta';

const PICKER_SHELL = {
  alignSelf: 'stretch' as const,
  borderRadius: 8,
  overflow: 'hidden' as const,
  marginBottom: 16,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHHmm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateLabel(d: Date | null): string {
  if (!d) return 'Elegir fecha';
  return d.toLocaleDateString('es-HN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BuscarRivalScreen() {
  const { colors, theme: appTheme } = useGlassTheme();
  const { theme } = useTheme();
  const opaqueSurface = theme === 'dark' ? '#121212' : '#FFFFFF';
  const params = useLocalSearchParams<{
    openCrear?: string | string[];
    reservaId?: string | string[];
    openSolicitudes?: string | string[];
  }>();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const solicitudModalWidth = useMemo(
    () => Math.round(Dimensions.get('screen').width * 0.7),
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [partidosDisponiblesRaw, setPartidosDisponiblesRaw] = useState<PartidoAbiertoWithRelations[]>([]);
  const [misEquipos, setMisEquipos] = useState<EquipoWithMembers[]>([]);

  const [explFechaDesde, setExplFechaDesde] = useState<Date | null>(null);
  const [explFechaHasta, setExplFechaHasta] = useState<Date | null>(null);
  const [explHoraInicio, setExplHoraInicio] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [explHoraFin, setExplHoraFin] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return d;
  });
  const [filtroPicker, setFiltroPicker] = useState<FiltroPicker | null>(null);
  const [draftPickerDate, setDraftPickerDate] = useState(new Date());
  const [vistaExplorar, setVistaExplorar] = useState<'lista' | 'mapa'>('lista');
  const [ubicacionActual, setUbicacionActual] = useState<{ lat: number; lng: number } | null>(null);

  const partidosDisponibles = useMemo(
    () => filterPartidosPorRangoHorario(partidosDisponiblesRaw, formatHHmm(explHoraInicio), formatHHmm(explHoraFin)),
    [partidosDisponiblesRaw, explHoraInicio, explHoraFin]
  );

  const [showEnviarSolicitud, setShowEnviarSolicitud] = useState(false);
  const [partidoSolicitar, setPartidoSolicitar] = useState<PartidoAbiertoWithRelations | null>(null);
  const [solicitudEquipoId, setSolicitudEquipoId] = useState('');
  const [solicitudMensaje, setSolicitudMensaje] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useEffect(() => {
    const open = params.openCrear === '1' || params.openCrear === 'true';
    const rid = Array.isArray(params.reservaId) ? params.reservaId[0] : params.reservaId;
    if (open && rid) {
      router.replace({
        pathname: '/(tabs)/mis-reservas',
        params: { openPublish: '1', reservaId: rid },
      });
      return;
    }
    const openSol = params.openSolicitudes === '1' || params.openSolicitudes === 'true';
    if (openSol) {
      router.replace({
        pathname: '/(tabs)/mis-reservas',
        params: { seccion: 'solicitudes' },
      });
    }
  }, [params.openCrear, params.reservaId, params.openSolicitudes]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUbicacionActual({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch {
          /* ignorar */
        }
      })();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadExplorarPartidos = async () => {
    const filtros: FiltrosPartidos = {};
    if (explFechaDesde) {
      const ymd = formatLocalDateYMD(explFechaDesde);
      const d = new Date(`${ymd}T00:00:00`);
      if (!Number.isNaN(d.getTime())) filtros.fechaDesde = d.toISOString();
    }
    if (explFechaHasta) {
      const ymd = formatLocalDateYMD(explFechaHasta);
      const d = new Date(`${ymd}T23:59:59.999`);
      if (!Number.isNaN(d.getTime())) filtros.fechaHasta = d.toISOString();
    }
    const list = await obtenerPartidosAbiertos(
      Object.keys(filtros).length > 0 ? filtros : undefined
    );
    setPartidosDisponiblesRaw(list);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [, equipos] = await Promise.all([loadExplorarPartidos(), obtenerEquiposJugador()]);
      setMisEquipos(equipos);
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      showError('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const aplicarFiltrosExplorar = async () => {
    try {
      setRefreshing(true);
      await loadExplorarPartidos();
    } catch (error: any) {
      console.error(error);
      showError('Error', 'No se pudieron aplicar los filtros');
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  useEffect(() => {
    if (!showEnviarSolicitud || solicitudEquipoId || misEquipos.length === 0) return;
    const equipoDefault =
      misEquipos.find((e) => e.es_principal)?.id ?? misEquipos[0]?.id ?? '';
    if (equipoDefault) setSolicitudEquipoId(equipoDefault);
  }, [showEnviarSolicitud, solicitudEquipoId, misEquipos]);

  const puedeEnviarSolicitud = Boolean(solicitudEquipoId) && !enviandoSolicitud;

  const abrirPedirReto = (partido: PartidoAbiertoWithRelations) => {
    const equipoDefault =
      misEquipos.find((e) => e.es_principal)?.id ?? misEquipos[0]?.id ?? '';
    setPartidoSolicitar(partido);
    setSolicitudEquipoId(equipoDefault);
    setSolicitudMensaje('');
    setShowEnviarSolicitud(true);
  };

  const handleEnviarSolicitud = async () => {
    if (!partidoSolicitar || !solicitudEquipoId) {
      showError('Equipo requerido', 'Seleccioná un equipo para enviar la solicitud');
      return;
    }

    try {
      setEnviandoSolicitud(true);
      await enviarSolicitudPartido(partidoSolicitar.id, solicitudEquipoId, solicitudMensaje || undefined);
      showSuccess('Solicitud enviada', 'El dueño del partido puede aceptarte o rechazarte.');
      setShowEnviarSolicitud(false);
      resetFormSolicitud();
      loadExplorarPartidos().catch((err) => console.error('Error al refrescar partidos:', err));
    } catch (error: any) {
      console.error('Error al enviar solicitud:', error);
      showError('Error', error.message || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const resetFormSolicitud = () => {
    setPartidoSolicitar(null);
    setSolicitudEquipoId('');
    setSolicitudMensaje('');
  };

  const setExplHoraInicioHour = useCallback((hour24: number) => {
    setExplHoraInicio((prev) => {
      const d = new Date(prev);
      d.setHours(hour24, 0, 0, 0);
      return d;
    });
  }, []);

  const setExplHoraFinHour = useCallback((hour24: number) => {
    setExplHoraFin((prev) => {
      const d = new Date(prev);
      d.setHours(hour24, 59, 0, 0);
      return d;
    });
  }, []);

  const openFiltroPicker = (kind: FiltroPicker) => {
    const base =
      kind === 'fechaDesde'
        ? explFechaDesde
          ? new Date(explFechaDesde)
          : new Date()
        : explFechaHasta
          ? new Date(explFechaHasta)
          : new Date();
    setDraftPickerDate(base);
    setFiltroPicker(kind);
  };

  const confirmFiltroPicker = () => {
    const v = new Date(draftPickerDate);
    if (filtroPicker === 'fechaDesde') setExplFechaDesde(v);
    if (filtroPicker === 'fechaHasta') setExplFechaHasta(v);
    setFiltroPicker(null);
  };

  const filtroPickerTitle = filtroPicker === 'fechaDesde' ? 'Fecha desde' : 'Fecha hasta';

  const formatFechaHora = (fechaHora: string) => {
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
  };

  if (loading && !refreshing && !showEnviarSolicitud && !filtroPicker) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlayerLoadingView message="Cargando..." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View
        className="px-md py-md border-b border-border-subtle dark:border-border-subtle-dark"
        style={{ backgroundColor: colors.background }}
      >
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/armemosla'))}
            className="p-xs"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Volver a Armemosla"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text variant="h3">Partidos buscando rival</Text>
          </View>
        </View>
      </View>

      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Surface
          variant="solid"
          className="p-md border-b border-border-subtle dark:border-border-subtle-dark gap-sm"
          style={{ backgroundColor: colors.background }}
        >
          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Text variant="label" className="mb-xs">
                Desde
              </Text>
              <Pressable
                className="flex-row items-center p-md rounded-lg border border-border-subtle dark:border-border-subtle-dark gap-sm"
                style={{ backgroundColor: opaqueSurface }}
                onPress={() => openFiltroPicker('fechaDesde')}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text variant={explFechaDesde ? 'body' : 'bodySecondary'} className="flex-1">
                  {formatDateLabel(explFechaDesde)}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View className="flex-1">
              <Text variant="label" className="mb-xs">
                Hasta
              </Text>
              <Pressable
                className="flex-row items-center p-md rounded-lg border border-border-subtle dark:border-border-subtle-dark gap-sm"
                style={{ backgroundColor: opaqueSurface }}
                onPress={() => openFiltroPicker('fechaHasta')}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text variant={explFechaHasta ? 'body' : 'bodySecondary'} className="flex-1">
                  {formatDateLabel(explFechaHasta)}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Text variant="label" className="mb-xs">
                Hora desde
              </Text>
              <HourOnlyTimePicker
                value={explHoraInicio}
                onHourChange={setExplHoraInicioHour}
                theme={appTheme}
                restrictToBookingHours={false}
              />
            </View>
            <View className="flex-1">
              <Text variant="label" className="mb-xs">
                Hora hasta
              </Text>
              <HourOnlyTimePicker
                value={explHoraFin}
                onHourChange={setExplHoraFinHour}
                theme={appTheme}
                restrictToBookingHours={false}
              />
            </View>
          </View>
          <Button size="sm" onPress={aplicarFiltrosExplorar}>
            Aplicar filtros de fecha
          </Button>
          <View className="flex-row gap-sm mt-sm">
            <Pressable
              className={cn(
                'flex-1 flex-row items-center justify-center py-sm rounded-lg gap-xs border',
                vistaExplorar === 'lista' ? 'bg-primary border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
              )}
              style={vistaExplorar !== 'lista' ? { backgroundColor: opaqueSurface } : undefined}
              onPress={() => setVistaExplorar('lista')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={vistaExplorar === 'lista' ? '#FFFFFF' : colors.text}
              />
              <Text variant={vistaExplorar === 'lista' ? 'inverse' : 'body'} className="text-sm font-medium">
                Lista
              </Text>
            </Pressable>
            <Pressable
              className={cn(
                'flex-1 flex-row items-center justify-center py-sm rounded-lg gap-xs border',
                vistaExplorar === 'mapa' ? 'bg-primary border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
              )}
              style={vistaExplorar !== 'mapa' ? { backgroundColor: opaqueSurface } : undefined}
              onPress={() => setVistaExplorar('mapa')}
            >
              <Ionicons
                name="map-outline"
                size={18}
                color={vistaExplorar === 'mapa' ? '#FFFFFF' : colors.text}
              />
              <Text variant={vistaExplorar === 'mapa' ? 'inverse' : 'body'} className="text-sm font-medium">
                Mapa
              </Text>
            </Pressable>
          </View>
        </Surface>

        {vistaExplorar === 'mapa' ? (
          <ScrollView
            className="flex-1"
            style={{ backgroundColor: colors.background }}
            contentContainerClassName="flex-grow min-h-[320px]"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {partidosDisponibles.length === 0 ? (
              <PlayerEmptyState
                variant="waitingPlayers"
                title="No hay partidos disponibles"
                text="Volvé más tarde o publicá tu partido desde Mis Potras."
                compact
              />
            ) : (
              <PartidosMapa
                markers={partidosToMapMarkers(partidosDisponibles)}
                ubicacionActual={ubicacionActual}
                onMarkerPress={(partidoId) => {
                  const p = partidosDisponibles.find((x) => x.id === partidoId);
                  if (p) abrirPedirReto(p);
                }}
              />
            )}
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1"
            style={{ backgroundColor: colors.background }}
            contentContainerClassName="p-md"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {partidosDisponibles.length === 0 ? (
              <PlayerEmptyState
                variant="waitingPlayers"
                title="No hay partidos disponibles"
                text="Volvé más tarde o publicá tu partido desde Mis Potras."
                compact
              />
            ) : (
              partidosDisponibles.map((partido) => {
                const reserva = partido.reserva as any;
                const { fecha, hora } = formatFechaHora(reserva?.fecha_hora || '');
                const equipo = partido.equipo as any;

                return (
                  <Surface
                    key={partido.id}
                    variant="solid"
                    className="mb-md p-md rounded-xl border border-border-subtle dark:border-border-subtle-dark"
                    style={{ backgroundColor: opaqueSurface }}
                  >
                    <View className="mb-sm">
                      <Text variant="h4">{reserva?.cancha?.nombre || 'Cancha'}</Text>
                      <Text variant="caption">{reserva?.cancha?.complejo?.nombre || 'Complejo'}</Text>
                    </View>

                    <View className="gap-xs mb-sm">
                      <View className="flex-row items-center gap-xs">
                        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                        <Text variant="caption">Fecha:</Text>
                        <Text variant="caption" className="flex-1 text-text dark:text-text-dark-default">
                          {fecha}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-xs">
                        <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                        <Text variant="caption">Hora:</Text>
                        <Text variant="caption" className="flex-1 text-text dark:text-text-dark-default">
                          {hora}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-xs">
                        <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                        <Text variant="caption">Busca:</Text>
                        <Text variant="caption" className="flex-1 text-text dark:text-text-dark-default">
                          {partido.jugadores_necesarios} jugadores
                        </Text>
                      </View>
                      {equipo && (
                        <View className="flex-row items-center gap-xs">
                          <Ionicons name="shirt-outline" size={18} color={colors.textSecondary} />
                          <Text variant="caption">Equipo:</Text>
                          <Text variant="caption" className="flex-1 text-text dark:text-text-dark-default">
                            {equipo.nombre}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Button onPress={() => abrirPedirReto(partido)}>
                      <View className="flex-row items-center gap-xs">
                        <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                        <Text variant="inverse" className="text-sm font-medium">
                          Quiero jugar
                        </Text>
                      </View>
                    </Button>
                  </Surface>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      {filtroPicker !== null ? (
      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible
        onBackdropPress={() => setFiltroPicker(null)}
        onBackButtonPress={() => setFiltroPicker(null)}
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
          <View className="flex-row justify-between items-center p-lg border-b border-border-subtle dark:border-border-subtle-dark">
            <Text variant="h3">{filtroPickerTitle}</Text>
            <TouchableOpacity onPress={() => setFiltroPicker(null)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ maxHeight: modalScrollAreaMaxHeight }}
            contentContainerClassName="p-lg"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <FechaHoraNativePickers
              part="date"
              draftDateTime={draftPickerDate}
              setDraftDateTime={setDraftPickerDate}
              pickerTheme={appTheme}
              weekdayLabelColor={colors.text}
              shellStyle={[PICKER_SHELL, { backgroundColor: opaqueSurface }]}
            />

            <View className="flex-row gap-sm pt-md border-t border-border-subtle dark:border-border-subtle-dark">
              <Button variant="outline" className="flex-1" onPress={() => setFiltroPicker(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" onPress={confirmFiltroPicker}>
                Listo
              </Button>
            </View>
          </ScrollView>
        </DialogSheet>
      </RNModal>
      ) : null}

      {showEnviarSolicitud ? (
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible
        onBackdropPress={() => setShowEnviarSolicitud(false)}
        onBackButtonPress={() => setShowEnviarSolicitud(false)}
        avoidKeyboard
        style={[rCenter, { paddingHorizontal: 0 }]}
      >
        <SafeAreaView
          className="self-center"
          style={{ width: solicitudModalWidth }}
          edges={['top', 'bottom']}
        >
          <Surface
            variant="glass"
            className="w-full overflow-hidden rounded-xl"
            style={{ maxHeight: modalMaxHeight }}
          >
            <View className="flex-row items-center justify-between p-lg border-b border-border-subtle dark:border-border-subtle-dark">
              <Text variant="h3">Solicitar partido</Text>
              <TouchableOpacity onPress={() => setShowEnviarSolicitud(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View className="mb-md">
                <Text variant="label" className="mb-xs">
                  Equipo *
                </Text>
                <ScrollView style={{ maxHeight: 150 }}>
                  {misEquipos.length === 0 ? (
                    <Text variant="caption">No tenés equipos. Creá uno en tu perfil.</Text>
                  ) : (
                    misEquipos.map((equipo) => (
                      <Pressable
                        key={equipo.id}
                        className={cn(
                          'flex-row items-center justify-between p-md rounded-lg border mb-sm',
                          solicitudEquipoId === equipo.id
                            ? 'bg-primary/20 border-primary'
                            : 'border-border-subtle dark:border-border-subtle-dark'
                        )}
                        onPress={() => setSolicitudEquipoId(equipo.id)}
                      >
                        <Text variant="body" className="flex-1">
                          {equipo.nombre}
                        </Text>
                        {solicitudEquipoId === equipo.id && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>

              <Input
                label="Mensaje (opcional)"
                value={solicitudMensaje}
                onChangeText={setSolicitudMensaje}
                placeholder="Escribí un mensaje para el equipo..."
                multiline
                numberOfLines={4}
                className="min-h-[100px] text-top"
              />
            </ScrollView>

            <View className="flex-row p-lg border-t border-border-subtle dark:border-border-subtle-dark gap-md">
              <Button variant="outline" className="flex-1" onPress={() => setShowEnviarSolicitud(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onPress={handleEnviarSolicitud}
                disabled={!puedeEnviarSolicitud}
                loading={enviandoSolicitud}
              >
                Enviar solicitud
              </Button>
            </View>
          </Surface>
        </SafeAreaView>
      </RNModal>
      ) : null}

      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        type={alertOptions.type}
        confirmText={alertOptions.confirmText}
        cancelText={alertOptions.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Screen>
  );
}
