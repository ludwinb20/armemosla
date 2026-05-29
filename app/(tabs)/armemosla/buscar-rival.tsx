import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
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
import { useThemeColors } from '../../../hooks/useThemeColors';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../../../lib/rnModalPresets';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import PartidosMapa, { partidosToMapMarkers } from '../../../components/PartidosMapa';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../../components/lottie/PlayerEmptyState';

export default function BuscarRivalScreen() {
  const colors = useThemeColors();
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

  const [explFechaDesdeText, setExplFechaDesdeText] = useState('');
  const [explFechaHastaText, setExplFechaHastaText] = useState('');
  const [explHoraInicio, setExplHoraInicio] = useState('00:00');
  const [explHoraFin, setExplHoraFin] = useState('23:59');
  const [vistaExplorar, setVistaExplorar] = useState<'lista' | 'mapa'>('lista');
  const [ubicacionActual, setUbicacionActual] = useState<{ lat: number; lng: number } | null>(null);
  const [explorarFiltroPicker, setExplorarFiltroPicker] = useState(false);

  const partidosDisponibles = useMemo(
    () => filterPartidosPorRangoHorario(partidosDisponiblesRaw, explHoraInicio, explHoraFin),
    [partidosDisponiblesRaw, explHoraInicio, explHoraFin]
  );

  const [showEnviarSolicitud, setShowEnviarSolicitud] = useState(false);
  const [partidoSolicitar, setPartidoSolicitar] = useState<PartidoAbiertoWithRelations | null>(null);
  const [solicitudEquipoId, setSolicitudEquipoId] = useState('');
  const [solicitudMensaje, setSolicitudMensaje] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  usePushNotifications();

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
    if (explFechaDesdeText.trim()) {
      const d = new Date(explFechaDesdeText.trim() + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) filtros.fechaDesde = d.toISOString();
    }
    if (explFechaHastaText.trim()) {
      const d = new Date(explFechaHastaText.trim() + 'T23:59:59.999');
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

  if (loading && !refreshing && !showEnviarSolicitud && !explorarFiltroPicker) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <PlayerLoadingView message="Cargando..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/armemosla'))}
            style={styles.headerBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Volver a Armemosla"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={[styles.title, { color: colors.text }]}>Partidos buscando rival</Text>
          </View>
        </View>
      </View>

      <View style={styles.exploreOuter}>
        <View
          style={[
            styles.exploreToolbar,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.exploreRow}>
            <View style={styles.exploreField}>
              <Text style={[styles.exploreLabel, { color: colors.textSecondary }]}>Desde (AAAA-MM-DD)</Text>
              <TextInput
                value={explFechaDesdeText}
                onChangeText={setExplFechaDesdeText}
                placeholder="Ej: 2026-04-10"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.exploreInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                ]}
              />
            </View>
            <View style={styles.exploreField}>
              <Text style={[styles.exploreLabel, { color: colors.textSecondary }]}>Hasta (AAAA-MM-DD)</Text>
              <TextInput
                value={explFechaHastaText}
                onChangeText={setExplFechaHastaText}
                placeholder="Ej: 2026-04-20"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.exploreInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                ]}
              />
            </View>
          </View>
          <View style={styles.exploreRow}>
            <View style={styles.exploreField}>
              <Text style={[styles.exploreLabel, { color: colors.textSecondary }]}>Hora desde (HH:mm)</Text>
              <TextInput
                value={explHoraInicio}
                onChangeText={setExplHoraInicio}
                placeholder="00:00"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.exploreInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                ]}
              />
            </View>
            <View style={styles.exploreField}>
              <Text style={[styles.exploreLabel, { color: colors.textSecondary }]}>Hora hasta (HH:mm)</Text>
              <TextInput
                value={explHoraFin}
                onChangeText={setExplHoraFin}
                placeholder="23:59"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.exploreInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                ]}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.aplicarFiltrosBtn, { backgroundColor: Colors.primary }]}
            onPress={aplicarFiltrosExplorar}
          >
            <Text style={styles.aplicarFiltrosBtnText}>Aplicar filtros de fecha</Text>
          </TouchableOpacity>
          <View style={styles.exploreToggleRow}>
            <TouchableOpacity
              style={[
                styles.exploreToggleBtn,
                { backgroundColor: vistaExplorar === 'lista' ? Colors.primary : colors.background },
              ]}
              onPress={() => setVistaExplorar('lista')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={vistaExplorar === 'lista' ? Colors.textInverse : colors.text}
              />
              <Text
                style={[
                  styles.exploreToggleText,
                  { color: vistaExplorar === 'lista' ? Colors.textInverse : colors.text },
                ]}
              >
                Lista
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exploreToggleBtn,
                { backgroundColor: vistaExplorar === 'mapa' ? Colors.primary : colors.background },
              ]}
              onPress={() => setVistaExplorar('mapa')}
            >
              <Ionicons
                name="map-outline"
                size={18}
                color={vistaExplorar === 'mapa' ? Colors.textInverse : colors.text}
              />
              <Text
                style={[
                  styles.exploreToggleText,
                  { color: vistaExplorar === 'mapa' ? Colors.textInverse : colors.text },
                ]}
              >
                Mapa
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {vistaExplorar === 'mapa' ? (
          <ScrollView
            style={styles.exploreMapScroll}
            contentContainerStyle={styles.exploreMapScrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                  <View
                    key={partido.id}
                    style={[styles.partidoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.partidoHeader}>
                      <View style={styles.partidoInfo}>
                        <Text style={[styles.partidoCancha, { color: colors.text }]}>
                          {reserva?.cancha?.nombre || 'Cancha'}
                        </Text>
                        <Text style={[styles.partidoComplejo, { color: colors.textSecondary }]}>
                          {reserva?.cancha?.complejo?.nombre || 'Complejo'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.partidoBody}>
                      <View style={styles.partidoRow}>
                        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.partidoLabel, { color: colors.textSecondary }]}>Fecha:</Text>
                        <Text style={[styles.partidoValue, { color: colors.text }]}>{fecha}</Text>
                      </View>
                      <View style={styles.partidoRow}>
                        <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.partidoLabel, { color: colors.textSecondary }]}>Hora:</Text>
                        <Text style={[styles.partidoValue, { color: colors.text }]}>{hora}</Text>
                      </View>
                      <View style={styles.partidoRow}>
                        <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.partidoLabel, { color: colors.textSecondary }]}>Busca:</Text>
                        <Text style={[styles.partidoValue, { color: colors.text }]}>
                          {partido.jugadores_necesarios} jugadores
                        </Text>
                      </View>
                      {equipo && (
                        <View style={styles.partidoRow}>
                          <Ionicons name="shirt-outline" size={18} color={colors.textSecondary} />
                          <Text style={[styles.partidoLabel, { color: colors.textSecondary }]}>Equipo:</Text>
                          <Text style={[styles.partidoValue, { color: colors.text }]}>{equipo.nombre}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.partidoActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Colors.primary }]}
                        onPress={() => abrirPedirReto(partido)}
                      >
                        <Ionicons name="send-outline" size={18} color={Colors.textInverse} />
                        <Text style={styles.actionButtonText}>Quiero jugar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showEnviarSolicitud}
        onBackdropPress={() => setShowEnviarSolicitud(false)}
        onBackButtonPress={() => setShowEnviarSolicitud(false)}
        avoidKeyboard
        style={[rCenter, styles.solicitudModalCenter]}
      >
        <SafeAreaView
          style={[styles.modalSheetOuter, { width: solicitudModalWidth }]}
          edges={['top', 'bottom']}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Solicitar partido</Text>
              <TouchableOpacity onPress={() => setShowEnviarSolicitud(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Equipo *</Text>
                <ScrollView style={styles.equiposList}>
                  {misEquipos.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No tenés equipos. Creá uno en tu perfil.
                    </Text>
                  ) : (
                    misEquipos.map((equipo) => (
                      <TouchableOpacity
                        key={equipo.id}
                        style={[
                          styles.equipoOption,
                          {
                            backgroundColor: solicitudEquipoId === equipo.id ? Colors.primary + '20' : colors.surface,
                            borderColor: solicitudEquipoId === equipo.id ? Colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setSolicitudEquipoId(equipo.id)}
                      >
                        <Text style={[styles.equipoOptionText, { color: colors.text }]}>{equipo.nombre}</Text>
                        {solicitudEquipoId === equipo.id && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Mensaje (opcional)</Text>
                <TextInput
                  style={[
                    styles.textArea,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  value={solicitudMensaje}
                  onChangeText={setSolicitudMensaje}
                  placeholder="Escribí un mensaje para el equipo..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                onPress={() => setShowEnviarSolicitud(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonSave,
                  {
                    backgroundColor: Colors.primary,
                    opacity: puedeEnviarSolicitud ? 1 : 0.45,
                  },
                ]}
                onPress={handleEnviarSolicitud}
                disabled={!puedeEnviarSolicitud}
              >
                {enviandoSolicitud ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Enviar solicitud</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </RNModal>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerBack: {
    padding: Spacing.xs,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  partidoCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  partidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  partidoInfo: {
    flex: 1,
  },
  partidoCancha: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  partidoComplejo: {
    fontSize: Typography.fontSize.sm,
  },
  partidoBody: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  partidoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  partidoLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  partidoValue: {
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  partidoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textInverse,
  },
  modalSheetOuter: {
    alignSelf: 'center',
  },
  solicitudModalCenter: {
    paddingHorizontal: 0,
  },
  modalCard: {
    borderRadius: BorderRadius.xl,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalBodyContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
    flexShrink: 0,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonSave: {
    ...Shadows.sm,
  },
  modalButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalButtonTextSave: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  equiposList: {
    maxHeight: 150,
  },
  equipoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  equipoOptionText: {
    fontSize: Typography.fontSize.md,
    flex: 1,
  },
  exploreOuter: {
    flex: 1,
  },
  exploreToolbar: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  exploreRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  exploreField: {
    flex: 1,
  },
  exploreLabel: {
    fontSize: Typography.fontSize.xs,
    marginBottom: 4,
  },
  exploreInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.sm,
  },
  aplicarFiltrosBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  aplicarFiltrosBtnText: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
    fontSize: Typography.fontSize.sm,
  },
  exploreToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  exploreToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exploreToggleText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  exploreMapScroll: {
    flex: 1,
  },
  exploreMapScrollContent: {
    flexGrow: 1,
    minHeight: 320,
  },
});
