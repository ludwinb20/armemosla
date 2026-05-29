import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  obtenerReservasJugadorPaginado,
  cancelarReserva,
  ReservaWithRelations,
  RESERVAS_JUGADOR_PAGE_SIZE,
} from '../../lib/reservas';
import {
  obtenerSolicitudesRetoPiscinaJugador,
  obtenerEstadosPartidoPorReservas,
  aceptarSolicitud,
  rechazarSolicitud,
  SolicitudRetoPiscinaItem,
} from '../../lib/partidos';
import { obtenerMensajesNoLeidosPorSolicitud } from '../../lib/mensajesSolicitud';
import PublicarPartidoModal from '../../components/PublicarPartidoModal';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../components/lottie/PlayerEmptyState';
import { LottieVariant } from '../../constants/lottieAssets';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatFechaHoraDisplay as formatFechaHora } from '../../lib/fechaHora';
import { sincronizarLogrosJugador } from '../../lib/logros';

type SeccionPotras = 'reservas' | 'solicitudes';
type FiltroEstadoReserva = 'todas' | 'pendiente' | 'completada' | 'cancelada';

type SolicitudListRow =
  | { kind: 'header'; id: string; title: string; subtitle?: string }
  | {
      kind: 'solicitud';
      id: string;
      item: SolicitudRetoPiscinaItem;
      section: 'pendiente' | 'historial';
    };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'completada':
    case 'aceptada':
    case 'aceptado':
      return Colors.success;
    case 'cancelada':
    case 'cancelado':
    case 'rechazada':
    case 'rechazado':
      return Colors.error;
    case 'pendiente':
    default:
      return Colors.warning;
  }
}

function getEstadoTexto(estado: string) {
  const map: Record<string, string> = {
    pendiente: 'Pendiente',
    completada: 'Completada',
    cancelada: 'Cancelada',
    aceptada: 'Aceptada',
    aceptado: 'Aceptado',
    rechazada: 'Rechazada',
    rechazado: 'Rechazado',
    cancelado: 'Cancelado',
  };
  return map[estado] || estado;
}

function mergeReservasUnique(
  prev: ReservaWithRelations[],
  next: ReservaWithRelations[]
): ReservaWithRelations[] {
  if (next.length === 0) return prev;
  const ids = new Set(prev.map((r) => r.id));
  const nuevas = next.filter((r) => !ids.has(r.id));
  if (nuevas.length === 0) return prev;
  return [...prev, ...nuevas];
}

export default function MisPotrasScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ seccion?: string | string[]; openPublish?: string | string[]; reservaId?: string | string[] }>();
  const seccionParam = Array.isArray(params.seccion) ? params.seccion[0] : params.seccion;
  const openPublishParam = params.openPublish === '1' || params.openPublish === 'true';
  const reservaIdParam = Array.isArray(params.reservaId) ? params.reservaId[0] : params.reservaId;

  const [seccion, setSeccion] = useState<SeccionPotras>('reservas');
  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [reservasOffset, setReservasOffset] = useState(0);
  const [reservasHasMore, setReservasHasMore] = useState(true);
  const [loadingMoreReservas, setLoadingMoreReservas] = useState(false);
  const [solicitudes, setSolicitudes] = useState<SolicitudRetoPiscinaItem[]>([]);
  const [estadoPartidoPorReservaId, setEstadoPartidoPorReservaId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMoreRef = useRef(false);
  const reservasOffsetRef = useRef(0);
  const reservasHasMoreRef = useRef(true);
  const filtroListoRef = useRef(false);
  const skipFiltroEffectRef = useRef(true);
  const solicitudesCargadasRef = useRef(false);
  const solicitudesEnCursoRef = useRef(false);
  const focusLoadEnCursoRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoReserva>('todas');
  const filtroEstadoRef = useRef(filtroEstado);
  filtroEstadoRef.current = filtroEstado;
  const [showPublicarModal, setShowPublicarModal] = useState(false);
  const [reservaIdPublicar, setReservaIdPublicar] = useState<string | undefined>();
  const [procesandoSolicitudId, setProcesandoSolicitudId] = useState<string | null>(null);
  const [noLeidosPorSolicitud, setNoLeidosPorSolicitud] = useState<Record<string, number>>({});
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } =
    useCustomAlert();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  useEffect(() => {
    if (seccionParam === 'solicitudes') {
      setSeccion('solicitudes');
    }
  }, [seccionParam]);

  useEffect(() => {
    if (openPublishParam && reservaIdParam) {
      setReservaIdPublicar(reservaIdParam);
      setShowPublicarModal(true);
    }
  }, [openPublishParam, reservaIdParam]);

  const loadSolicitudesYPartidos = useCallback(async () => {
    if (solicitudesEnCursoRef.current) return;
    solicitudesEnCursoRef.current = true;
    setLoadingSolicitudes(true);
    try {
      const solicitudesResult = await obtenerSolicitudesRetoPiscinaJugador()
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((reason) => ({ status: 'rejected' as const, reason }));

      if (solicitudesResult.status === 'fulfilled') {
        setSolicitudes(solicitudesResult.value);
        solicitudesCargadasRef.current = true;
        try {
          const counts = await obtenerMensajesNoLeidosPorSolicitud(
            solicitudesResult.value.map((s) => ({
              id: s.id,
              mensaje: s.mensaje,
              created_at: s.created_at,
              direccion: s.direccion,
            }))
          );
          setNoLeidosPorSolicitud(counts);
        } catch (err) {
          console.error('Error conteo no leídos:', err);
          setNoLeidosPorSolicitud({});
        }
      } else {
        console.error('Error solicitudes:', solicitudesResult.reason);
      }

      return { solicitudesResult };
    } finally {
      solicitudesEnCursoRef.current = false;
      setLoadingSolicitudes(false);
    }
  }, []);

  const aplicarEstadosPartido = useCallback(
    async (reservaIds: string[], merge = false) => {
      if (reservaIds.length === 0) {
        if (!merge) setEstadoPartidoPorReservaId({});
        return;
      }
      const map = await obtenerEstadosPartidoPorReservas(reservaIds);
      if (merge) {
        setEstadoPartidoPorReservaId((prev) => ({ ...prev, ...map }));
      } else {
        setEstadoPartidoPorReservaId(map);
      }
    },
    []
  );

  const loadReservasPage = useCallback(
    async (replace: boolean, estado: FiltroEstadoReserva) => {
      const offset = replace ? 0 : reservasOffsetRef.current;
      const { items, hasMore } = await obtenerReservasJugadorPaginado(
        offset,
        RESERVAS_JUGADOR_PAGE_SIZE,
        estado
      );
      const nextOffset = offset + items.length;
      reservasOffsetRef.current = nextOffset;
      reservasHasMoreRef.current = hasMore;
      setReservas((prev) => (replace ? items : mergeReservasUnique(prev, items)));
      setReservasOffset(nextOffset);
      setReservasHasMore(hasMore);
      await aplicarEstadosPartido(
        items.map((r) => r.id),
        !replace
      );
    },
    [aplicarEstadosPartido]
  );

  const loadInitial = useCallback(async (opts?: { incluirSolicitudes?: boolean }) => {
    if (focusLoadEnCursoRef.current) return;
    focusLoadEnCursoRef.current = true;
    setLoading(true);
    const estado = filtroEstadoRef.current;
    try {
      const reservasResult = await obtenerReservasJugadorPaginado(
        0,
        RESERVAS_JUGADOR_PAGE_SIZE,
        estado
      );

      setReservas(reservasResult.items);
      reservasOffsetRef.current = reservasResult.items.length;
      reservasHasMoreRef.current = reservasResult.hasMore;
      setReservasOffset(reservasResult.items.length);
      setReservasHasMore(reservasResult.hasMore);

      await aplicarEstadosPartido(reservasResult.items.map((r) => r.id));
    } catch (error) {
      console.error('Error cargando reservas:', error);
      showErrorRef.current('Error', 'No se pudieron cargar tus potras');
    } finally {
      setLoading(false);
      setRefreshing(false);
      filtroListoRef.current = true;
      focusLoadEnCursoRef.current = false;
      lastRefreshAtRef.current = Date.now();
    }

    void sincronizarLogrosJugador().then((sync) => {
      if (!sync.ok && sync.reason !== 'rpc_missing') {
        console.warn('[MisPotras] sync logros:', sync.message);
      }
    });

    if (opts?.incluirSolicitudes !== false) {
      void loadSolicitudesYPartidos().then((meta) => {
        if (meta?.solicitudesResult.status === 'rejected') {
          console.warn('Solicitudes no cargadas en segundo plano');
        }
      });
    }
  }, [aplicarEstadosPartido, loadSolicitudesYPartidos]);

  const loadMoreReservas = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      !reservasHasMoreRef.current ||
      loading ||
      loadingMoreReservas
    ) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMoreReservas(true);
    try {
      await loadReservasPage(false, filtroEstado);
    } catch (error) {
      console.error('Error cargando más reservas:', error);
      showErrorRef.current('Error', 'No se pudieron cargar más reservas');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMoreReservas(false);
    }
  }, [loading, loadingMoreReservas, loadReservasPage, filtroEstado]);

  const reloadReservas = useCallback(async () => {
    if (loadingMoreRef.current) return;
    try {
      const { items, hasMore } = await obtenerReservasJugadorPaginado(
        0,
        RESERVAS_JUGADOR_PAGE_SIZE,
        filtroEstado
      );
      reservasOffsetRef.current = items.length;
      reservasHasMoreRef.current = hasMore;
      setReservas(items);
      setReservasOffset(items.length);
      setReservasHasMore(hasMore);
      await aplicarEstadosPartido(items.map((r) => r.id));
      lastRefreshAtRef.current = Date.now();
      void sincronizarLogrosJugador();
    } catch (error) {
      console.error('Error recargando reservas:', error);
    }
  }, [filtroEstado, aplicarEstadosPartido]);

  useFocusEffect(
    useCallback(() => {
      if (!filtroListoRef.current) {
        void loadInitial();
        return;
      }
      const stale = Date.now() - lastRefreshAtRef.current > 45_000;
      if (stale) {
        lastRefreshAtRef.current = Date.now();
        void reloadReservas();
      }
    }, [loadInitial, reloadReservas])
  );

  useEffect(() => {
    if (!filtroListoRef.current) return;
    if (skipFiltroEffectRef.current) {
      skipFiltroEffectRef.current = false;
      return;
    }
    reservasOffsetRef.current = 0;
    reservasHasMoreRef.current = true;
    void reloadReservas();
  }, [filtroEstado, reloadReservas]);

  useEffect(() => {
    if (seccion !== 'solicitudes' || solicitudesCargadasRef.current) return;
    void loadSolicitudesYPartidos();
  }, [seccion, loadSolicitudesYPartidos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadReservas();
      lastRefreshAtRef.current = Date.now();
      await loadSolicitudesYPartidos();
      void sincronizarLogrosJugador();
    } finally {
      setRefreshing(false);
    }
  }, [reloadReservas, loadSolicitudesYPartidos]);

  const onEndReached = () => {
    if (seccion !== 'reservas' || loading) return;
    void loadMoreReservas();
  };

  const handleCancelarReserva = (reservaId: string) => {
    showError(
      'Cancelar reserva',
      '¿Estás seguro de que deseas cancelar esta reserva?',
      () => cancelarReservaAsync(reservaId),
      () => {},
      'Volver',
      'Confirmar'
    );
  };

  const cancelarReservaAsync = async (reservaId: string) => {
    try {
      await cancelarReserva(reservaId);
      showSuccess('Éxito', 'Reserva cancelada correctamente');
      await Promise.all([reloadReservas(), loadSolicitudesYPartidos()]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo cancelar la reserva';
      showError('Error', msg);
    }
  };

  const solicitudesPendientes = useMemo(
    () =>
      solicitudes
        .filter((s) => s.estado === 'pendiente')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [solicitudes]
  );

  const solicitudesHistorial = useMemo(
    () =>
      solicitudes
        .filter((s) => s.estado !== 'pendiente' && s.estado !== 'aceptada')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [solicitudes]
  );

  const totalPendientesRecibidas = solicitudesPendientes.filter((s) => s.direccion === 'recibida').length;

  const totalMensajesNoLeidos = useMemo(
    () => Object.values(noLeidosPorSolicitud).reduce((sum, n) => sum + n, 0),
    [noLeidosPorSolicitud]
  );

  const badgeSolicitudesTab =
    totalMensajesNoLeidos > 0 ? totalMensajesNoLeidos : totalPendientesRecibidas;

  const handleAbrirConversacion = (solicitudId: string) => {
    router.push({
      pathname: '/solicitud-chat',
      params: { solicitudId },
    });
  };

  const handleAceptarSolicitud = async (solicitudId: string) => {
    try {
      setProcesandoSolicitudId(solicitudId);
      await aceptarSolicitud(solicitudId);
      showSuccess('Listo', 'Rival confirmado. Lo verás en tus reservas.');
      await Promise.all([reloadReservas(), loadSolicitudesYPartidos()]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo aceptar la solicitud';
      showError('Error', msg);
    } finally {
      setProcesandoSolicitudId(null);
    }
  };

  const handleRechazarSolicitud = async (solicitudId: string) => {
    try {
      setProcesandoSolicitudId(solicitudId);
      await rechazarSolicitud(solicitudId);
      showSuccess('Listo', 'Solicitud rechazada');
      await Promise.all([reloadReservas(), loadSolicitudesYPartidos()]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo rechazar la solicitud';
      showError('Error', msg);
    } finally {
      setProcesandoSolicitudId(null);
    }
  };

  const abrirPublicar = (reservaId: string) => {
    setReservaIdPublicar(reservaId);
    setShowPublicarModal(true);
  };

  const solicitudesFlatData = useMemo((): SolicitudListRow[] => {
    const rows: SolicitudListRow[] = [];
    if (solicitudesPendientes.length > 0) {
      rows.push({
        kind: 'header',
        id: 'header-pendientes',
        title: 'Pendientes',
        subtitle: 'Solicitudes en espera de respuesta',
      });
      for (const sol of solicitudesPendientes) {
        rows.push({ kind: 'solicitud', id: `pend-${sol.id}`, item: sol, section: 'pendiente' });
      }
    }
    if (solicitudesHistorial.length > 0) {
      rows.push({
        kind: 'header',
        id: 'header-historial',
        title: 'Historial',
        subtitle: 'Rechazadas y canceladas · las confirmadas están en Reservas',
      });
      for (const sol of solicitudesHistorial) {
        rows.push({ kind: 'solicitud', id: `hist-${sol.id}`, item: sol, section: 'historial' });
      }
    }
    return rows;
  }, [solicitudesPendientes, solicitudesHistorial]);

  const listaVaciaReservas = seccion === 'reservas' && reservas.length === 0;
  const listaVaciaSolicitudes = seccion === 'solicitudes' && solicitudesFlatData.length === 0;

  const renderReservaItem = useCallback(
    ({ item: reserva }: { item: ReservaWithRelations }) => (
      <ReservaCard
        reserva={reserva}
        colors={colors}
        estadoPartido={estadoPartidoPorReservaId[reserva.id]}
        onCancelar={handleCancelarReserva}
        onBuscarRival={
          reserva.estado === 'pendiente' &&
          !reserva.rival &&
          (!estadoPartidoPorReservaId[reserva.id] || estadoPartidoPorReservaId[reserva.id] === 'cancelado')
            ? () => abrirPublicar(reserva.id)
            : undefined
        }
      />
    ),
    [colors, estadoPartidoPorReservaId, handleCancelarReserva]
  );

  const renderSolicitudRow = useCallback(
    ({ item: row }: { item: SolicitudListRow }) => {
      if (row.kind === 'header') {
        return <SectionHeader title={row.title} subtitle={row.subtitle} colors={colors} />;
      }
      const sol = row.item;
      const esPendiente = row.section === 'pendiente';
      return (
        <SolicitudPiscinaCard
          item={sol}
          colors={colors}
          mensajesNoLeidos={noLeidosPorSolicitud[sol.id] || 0}
          destacado={esPendiente && sol.direccion === 'recibida'}
          procesando={procesandoSolicitudId === sol.id}
          onPress={() => handleAbrirConversacion(sol.id)}
          onAceptar={
            esPendiente && sol.direccion === 'recibida' && sol.estado === 'pendiente'
              ? () => handleAceptarSolicitud(sol.id)
              : undefined
          }
          onRechazar={
            esPendiente && sol.direccion === 'recibida' && sol.estado === 'pendiente'
              ? () => handleRechazarSolicitud(sol.id)
              : undefined
          }
        />
      );
    },
    [
      colors,
      noLeidosPorSolicitud,
      procesandoSolicitudId,
      handleAbrirConversacion,
      handleAceptarSolicitud,
      handleRechazarSolicitud,
    ]
  );

  const listFooter = useMemo(() => {
    if (seccion === 'reservas' && loadingMoreReservas) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={[styles.listFooterText, { color: colors.textSecondary }]}>Cargando más...</Text>
        </View>
      );
    }
    if (seccion === 'solicitudes' && loadingSolicitudes && solicitudesFlatData.length === 0) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={[styles.listFooterText, { color: colors.textSecondary }]}>Cargando solicitudes...</Text>
        </View>
      );
    }
    return null;
  }, [seccion, loadingMoreReservas, loadingSolicitudes, solicitudesFlatData.length, colors.textSecondary]);

  const flatListPerf = {
    initialNumToRender: 6,
    maxToRenderPerBatch: 8,
    windowSize: 7,
    removeClippedSubviews: true,
  } as const;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <PlayerLoadingView message="Cargando..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.title, { color: colors.text }]}>Mis Potras</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Tus canchas reservadas y solicitudes de partido
        </Text>
      </View>

      <View style={[styles.seccionContainer, { borderBottomColor: colors.borderLight }]}>
        <View style={styles.seccionRow}>
          {(
            [
              { key: 'reservas' as const, label: 'Reservas', icon: 'calendar-outline' as const },
              { key: 'solicitudes' as const, label: 'Solicitudes', icon: 'mail-outline' as const },
            ] as const
          ).map(({ key, label, icon }) => {
            const activo = seccion === key;
            const badge = key === 'solicitudes' && badgeSolicitudesTab > 0 ? badgeSolicitudesTab : 0;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.seccionTab,
                  {
                    backgroundColor: activo ? Colors.primary : colors.surface,
                    borderColor: activo ? Colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSeccion(key)}
              >
                <Ionicons name={icon} size={18} color={activo ? Colors.textInverse : colors.text} />
                <Text
                  style={[
                    styles.seccionTabText,
                    { color: activo ? Colors.textInverse : colors.text },
                  ]}
                >
                  {label}
                </Text>
                {badge > 0 && (
                  <View style={[styles.seccionBadge, { backgroundColor: activo ? Colors.textInverse : Colors.error }]}>
                    <Text style={[styles.seccionBadgeText, { color: activo ? Colors.primary : Colors.textInverse }]}>
                      {badge > 9 ? '9+' : badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {seccion === 'reservas' && (
        <View style={[styles.filtrosContainer, { borderBottomColor: colors.borderLight }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosContent}>
            {(['todas', 'pendiente', 'completada', 'cancelada'] as FiltroEstadoReserva[]).map((estado) => (
              <TouchableOpacity
                key={estado}
                style={[
                  styles.filtroChip,
                  {
                    backgroundColor: filtroEstado === estado ? Colors.primary : colors.surface,
                    borderColor: filtroEstado === estado ? Colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFiltroEstado(estado)}
              >
                <Text
                  style={[
                    styles.filtroChipText,
                    { color: filtroEstado === estado ? Colors.textInverse : colors.text },
                  ]}
                >
                  {estado === 'todas' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {seccion === 'reservas' ? (
        <FlatList
          key={`reservas-${filtroEstado}`}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            listaVaciaReservas && styles.scrollContentEmpty,
          ]}
          data={reservas}
          keyExtractor={(item) => item.id}
          renderItem={renderReservaItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={listFooter}
          {...flatListPerf}
          ListEmptyComponent={
            <EmptyState
              variant="emptyField"
              title={filtroEstado === 'todas' ? 'No hay reservas' : `No hay reservas ${filtroEstado}s`}
              text={
                filtroEstado === 'todas'
                  ? 'Aún no has realizado ninguna reserva'
                  : `No tienes reservas con estado "${filtroEstado}"`
              }
            />
          }
        />
      ) : (
        <FlatList
          key="solicitudes"
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            listaVaciaSolicitudes && styles.scrollContentEmpty,
          ]}
          data={solicitudesFlatData}
          keyExtractor={(item) => item.id}
          renderItem={renderSolicitudRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListFooterComponent={listFooter}
          {...flatListPerf}
          ListEmptyComponent={
            <EmptyState
              variant="waitingPlayers"
              title="Sin solicitudes"
              text="Las solicitudes que envíes o recibas aparecerán aquí. Los rivales confirmados se ven en Reservas."
            />
          }
        />
      )}

      <PublicarPartidoModal
        visible={showPublicarModal}
        reservaIdPrefilled={reservaIdPublicar}
        onClose={() => {
          setShowPublicarModal(false);
          setReservaIdPublicar(undefined);
        }}
        onSuccess={async () => {
          showSuccess('Partido publicado', 'Tu partido ya busca rival. Revisá solicitudes aquí.');
          setSeccion('solicitudes');
          await Promise.all([reloadReservas(), loadSolicitudesYPartidos()]);
        }}
      />

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

function SectionHeader({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function EmptyState({
  variant,
  title,
  text,
}: {
  variant: LottieVariant;
  title: string;
  text: string;
}) {
  return <PlayerEmptyState variant={variant} title={title} text={text} compact />;
}

function ReservaCard({
  reserva,
  colors,
  estadoPartido,
  onCancelar,
  onBuscarRival,
}: {
  reserva: ReservaWithRelations;
  colors: ReturnType<typeof useThemeColors>;
  estadoPartido?: string;
  onCancelar: (id: string) => void;
  onBuscarRival?: () => void;
}) {
  const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
  const estadoColor = getEstadoColor(reserva.estado);
  const esPendiente = reserva.estado === 'pendiente';
  const precio = (reserva.cancha as { precio_por_hora?: number })?.precio_por_hora || 0;
  const buscandoRival = estadoPartido === 'abierto';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: esPendiente ? Colors.primary + '40' : colors.border,
          borderLeftWidth: esPendiente ? 4 : 1,
        },
        esPendiente && Shadows.md,
      ]}
    >
      {esPendiente && (
        <View style={[styles.inlineBadge, { backgroundColor: Colors.primary + '20' }]}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <Text style={[styles.inlineBadgeText, { color: Colors.primary }]}>Pendiente</Text>
        </View>
      )}

      {buscandoRival && !reserva.rival && (
        <View style={[styles.inlineBadge, { backgroundColor: Colors.warning + '20' }]}>
          <Ionicons name="search-outline" size={14} color={Colors.warning} />
          <Text style={[styles.inlineBadgeText, { color: Colors.warning }]}>Buscando rival</Text>
        </View>
      )}

      {reserva.rival && (
        <View style={[styles.rivalBadge, { backgroundColor: Colors.success + '20' }]}>
          <Ionicons name="people-outline" size={16} color={Colors.success} />
          <View style={styles.rivalBadgeTextWrap}>
            <Text style={[styles.rivalBadgeTitle, { color: Colors.success }]}>Rival confirmado</Text>
            <Text style={[styles.rivalBadgeEquipo, { color: colors.text }]}>{reserva.rival.equipoNombre}</Text>
          </View>
        </View>
      )}

      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {(reserva.cancha as { nombre?: string })?.nombre || 'Cancha'}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            {(reserva.cancha as { complejo?: { nombre?: string } })?.complejo?.nombre || 'Complejo'}
          </Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '20' }]}>
          <Text style={[styles.estadoBadgeText, { color: estadoColor }]}>{getEstadoTexto(reserva.estado)}</Text>
        </View>
      </View>

      <InfoRow icon="calendar-outline" label="Fecha" value={fecha} colors={colors} />
      <InfoRow icon="time-outline" label="Hora" value={hora} colors={colors} />
      <InfoRow icon="cash-outline" label="Precio" value={formatCurrency(precio)} colors={colors} valueColor={Colors.success} />

      {esPendiente && (
        <View style={styles.reservaActions}>
          {onBuscarRival && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              onPress={onBuscarRival}
            >
              <Ionicons name="people-outline" size={18} color={Colors.textInverse} />
              <Text style={[styles.actionButtonText, { color: Colors.textInverse }]}>Buscar rival</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: Colors.error, flex: onBuscarRival ? 0 : 1 }]}
            onPress={() => onCancelar(reserva.id)}
          >
            <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
            <Text style={[styles.actionButtonText, { color: Colors.error }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SolicitudPiscinaCard({
  item,
  colors,
  onPress,
  onAceptar,
  onRechazar,
  destacado,
  procesando,
  mensajesNoLeidos = 0,
}: {
  item: SolicitudRetoPiscinaItem;
  colors: ReturnType<typeof useThemeColors>;
  onPress?: () => void;
  onAceptar?: () => void;
  onRechazar?: () => void;
  destacado?: boolean;
  procesando?: boolean;
  mensajesNoLeidos?: number;
}) {
  const fh = item.reservaFechaHora ? formatFechaHora(item.reservaFechaHora) : null;
  const estadoColor = getEstadoColor(item.estado);
  const contrincante =
    item.direccion === 'enviada'
      ? `A ${item.equipoAnfitrionNombre || 'anfitrión'}`
      : `De ${item.equipoSolicitanteNombre}`;

  const cardContent = (
    <>
      <View style={styles.cardHeader}>
        <View style={[styles.inlineBadge, { backgroundColor: Colors.warning + '20' }]}>
          <Ionicons name="football-outline" size={14} color={Colors.warning} />
          <Text style={[styles.inlineBadgeText, { color: Colors.warning }]}>Partido buscando rival</Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '20' }]}>
          <Text style={[styles.estadoBadgeText, { color: estadoColor }]}>{getEstadoTexto(item.estado)}</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: colors.text, marginTop: Spacing.xs }]}>{contrincante}</Text>
      {item.canchaNombre && (
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
          {item.canchaNombre}
          {item.complejoNombre ? ` · ${item.complejoNombre}` : ''}
        </Text>
      )}
      {fh && <InfoRow icon="calendar-outline" label="Partido" value={`${fh.fecha} · ${fh.hora}`} colors={colors} />}
      {item.mensaje ? (
        <Text style={[styles.mensajeText, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.mensaje}
        </Text>
      ) : null}
      <View style={styles.solicitudFooter}>
        <DireccionBadge
          direccion={item.direccion === 'enviada' ? 'Solicitud enviada' : 'Solicitud recibida'}
          colors={colors}
        />
        {onPress && (
          <View style={styles.chatHint}>
            <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
            <Text style={[styles.chatHintText, { color: Colors.primary }]}>Ver conversación</Text>
            {mensajesNoLeidos > 0 && (
              <View style={styles.msgCountBadge}>
                <Text style={styles.msgCountBadgeText}>
                  {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      {(onAceptar || onRechazar) && (
        <View style={styles.solicitudActions}>
          {onRechazar && (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: Colors.error, flex: 1 }]}
              onPress={onRechazar}
              disabled={procesando}
            >
              {procesando ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="close-outline" size={18} color={Colors.error} />
                  <Text style={[styles.actionButtonText, { color: Colors.error }]}>Rechazar</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {onAceptar && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary, { backgroundColor: Colors.success, borderColor: Colors.success, flex: 1 }]}
              onPress={onAceptar}
              disabled={procesando}
            >
              {procesando ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={18} color={Colors.textInverse} />
                  <Text style={[styles.actionButtonText, { color: Colors.textInverse }]}>Aceptar</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: destacado ? Colors.warning + '60' : colors.border,
            borderLeftWidth: destacado ? 4 : 1,
          },
        ]}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: destacado ? Colors.warning + '60' : colors.border,
          borderLeftWidth: destacado ? 4 : 1,
        },
      ]}
    >
      {cardContent}
    </View>
  );
}

function DireccionBadge({
  direccion,
  colors,
}: {
  direccion: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={[styles.direccionBadge, { backgroundColor: colors.background }]}>
      <Text style={[styles.direccionText, { color: colors.textSecondary }]}>{direccion}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: valueColor || colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, fontSize: Typography.fontSize.md },
  header: { padding: Spacing.md, borderBottomWidth: 1 },
  title: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold },
  subtitle: { fontSize: Typography.fontSize.sm, marginTop: 4 },
  seccionContainer: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  seccionRow: { flexDirection: 'row', gap: Spacing.sm },
  seccionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  seccionTabText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
  seccionBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  seccionBadgeText: { fontSize: 10, fontWeight: Typography.fontWeight.bold },
  sectionHeader: { marginBottom: Spacing.sm, marginTop: Spacing.xs },
  sectionTitle: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
  sectionSubtitle: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  filtrosContainer: { paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  filtrosContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  filtroChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  filtroChipText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  scrollContentEmpty: { flexGrow: 1 },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  listFooterText: { fontSize: Typography.fontSize.sm },
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
  emptyText: { fontSize: Typography.fontSize.sm, textAlign: 'center' },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  cardSubtitle: { fontSize: Typography.fontSize.sm, marginBottom: Spacing.xs },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  inlineBadgeText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  rivalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rivalBadgeTextWrap: { flex: 1, minWidth: 0 },
  rivalBadgeTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  rivalBadgeEquipo: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, marginTop: 2 },
  estadoBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  estadoBadgeText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: Spacing.xs },
  infoLabel: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  infoValue: { fontSize: Typography.fontSize.sm, flex: 1 },
  mensajeText: { fontSize: Typography.fontSize.sm, fontStyle: 'italic', marginTop: Spacing.sm },
  solicitudFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  chatHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatHintText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  msgCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  msgCountBadgeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textInverse,
  },
  direccionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  direccionText: { fontSize: Typography.fontSize.xs },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  actionButtonPrimary: { flex: 1 },
  reservaActions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  solicitudActions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  actionButtonText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
});
