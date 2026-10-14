import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  obtenerReservasJugadorPaginado,
  cancelarReserva,
  ReservaWithRelations,
  RESERVAS_JUGADOR_PAGE_SIZE,
} from '../../lib/reservas';
import {
  obtenerSolicitudesRetoPiscinaJugador,
  obtenerRetosDirectosJugador,
  obtenerEstadosPartidoPorReservas,
  aceptarSolicitud,
  rechazarSolicitud,
  aceptarRetoDirectoJugador,
  rechazarRetoDirectoJugador,
  cancelarRetoDirectoJugador,
  SolicitudRetoPiscinaItem,
  RetoDirectoItem,
} from '../../lib/partidos';
import { obtenerMensajesNoLeidosPorSolicitud } from '../../lib/mensajesSolicitud';
import PublicarPartidoModal from '../../components/PublicarPartidoModal';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../components/lottie/PlayerEmptyState';
import { LottieVariant } from '../../constants/lottieAssets';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { formatFechaHoraDisplay as formatFechaHora } from '../../lib/fechaHora';
import { sincronizarLogrosJugador } from '../../lib/logros';
import { Screen, Text, Button, Card, Chip } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';

type SeccionPotras = 'reservas' | 'solicitudes';
type FiltroEstadoReserva = 'todas' | 'pendiente' | 'completada' | 'cancelada';

type SolicitudListRow =
  | { kind: 'header'; id: string; title: string; subtitle?: string }
  | {
      kind: 'solicitud';
      id: string;
      item: SolicitudRetoPiscinaItem;
      section: 'pendiente' | 'historial';
    }
  | {
      kind: 'reto_directo';
      id: string;
      item: RetoDirectoItem;
      section: 'pendiente' | 'historial';
    };

type SolicitudMixRow = Extract<SolicitudListRow, { kind: 'solicitud' | 'reto_directo' }>;

function mixRowTimestamp(row: SolicitudMixRow): number {
  return new Date(row.item.created_at).getTime();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getEstadoColor(estado: string, brand: { success: string; error: string; warning: string }) {
  switch (estado) {
    case 'completada':
    case 'aceptada':
    case 'aceptado':
      return brand.success;
    case 'cancelada':
    case 'cancelado':
    case 'rechazada':
    case 'rechazado':
      return brand.error;
    case 'pendiente':
    default:
      return brand.warning;
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

function getPartidoEstadoDisplay(
  estadoPartido: string | undefined,
  tieneRival: boolean,
  colors: { success: string; warning: string; primary: string }
): { text: string; color: string } | null {
  if (tieneRival) {
    return { text: 'Rival confirmado', color: colors.success };
  }
  switch (estadoPartido) {
    case 'abierto':
      return { text: 'Buscando rival', color: colors.warning };
    case 'en_negociacion':
      return { text: 'En negociación', color: colors.primary };
    case 'confirmado':
      return { text: 'Partido confirmado', color: colors.success };
    default:
      return null;
  }
}

function EstadoBadge({ text, color }: { text: string; color: string }) {
  return (
    <View className="px-sm py-1 rounded-sm" style={{ backgroundColor: color + '20' }}>
      <Text variant="caption" className="font-semibold" style={{ color }}>
        {text}
      </Text>
    </View>
  );
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
  const { colors } = useGlassTheme();
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
  const [retosDirectos, setRetosDirectos] = useState<RetoDirectoItem[]>([]);
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
  const [procesandoRetoId, setProcesandoRetoId] = useState<string | null>(null);
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
      const [solicitudesResult, retosResult] = await Promise.all([
        obtenerSolicitudesRetoPiscinaJugador()
          .then((value) => ({ status: 'fulfilled' as const, value }))
          .catch((reason) => ({ status: 'rejected' as const, reason })),
        obtenerRetosDirectosJugador()
          .then((value) => ({ status: 'fulfilled' as const, value }))
          .catch((reason) => ({ status: 'rejected' as const, reason })),
      ]);

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

      if (retosResult.status === 'fulfilled') {
        setRetosDirectos(retosResult.value);
      } else {
        console.error('Error retos directos:', retosResult.reason);
      }

      return { solicitudesResult, retosResult };
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

  const retosPendientes = useMemo(
    () =>
      retosDirectos
        .filter((r) => r.estado === 'pendiente')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [retosDirectos]
  );

  const retosHistorial = useMemo(
    () =>
      retosDirectos
        .filter((r) => r.estado === 'rechazado' || r.estado === 'cancelado')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [retosDirectos]
  );

  const totalPendientesRecibidas =
    solicitudesPendientes.filter((s) => s.direccion === 'recibida').length +
    retosPendientes.filter((r) => r.direccion === 'recibido').length;

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

  const handleAceptarRetoDirecto = async (retoId: string) => {
    try {
      setProcesandoRetoId(retoId);
      await aceptarRetoDirectoJugador(retoId);
      showSuccess('Listo', 'Reto aceptado. Lo verás como rival en tus reservas.');
      await Promise.all([reloadReservas(), loadSolicitudesYPartidos()]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo aceptar el reto';
      showError('Error', msg);
    } finally {
      setProcesandoRetoId(null);
    }
  };

  const handleRechazarRetoDirecto = async (retoId: string) => {
    try {
      setProcesandoRetoId(retoId);
      await rechazarRetoDirectoJugador(retoId);
      showSuccess('Listo', 'Reto rechazado');
      await loadSolicitudesYPartidos();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo rechazar el reto';
      showError('Error', msg);
    } finally {
      setProcesandoRetoId(null);
    }
  };

  const handleCancelarRetoDirecto = async (retoId: string) => {
    try {
      setProcesandoRetoId(retoId);
      await cancelarRetoDirectoJugador(retoId);
      showSuccess('Listo', 'Invitación cancelada');
      await loadSolicitudesYPartidos();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo cancelar el reto';
      showError('Error', msg);
    } finally {
      setProcesandoRetoId(null);
    }
  };

  const abrirPublicar = (reservaId: string) => {
    setReservaIdPublicar(reservaId);
    setShowPublicarModal(true);
  };

  const solicitudesFlatData = useMemo((): SolicitudListRow[] => {
    const rows: SolicitudListRow[] = [];
    const pendientesMix: SolicitudMixRow[] = [
      ...solicitudesPendientes.map(
        (sol): SolicitudMixRow => ({
          kind: 'solicitud',
          id: `pend-sol-${sol.id}`,
          item: sol,
          section: 'pendiente',
        })
      ),
      ...retosPendientes.map(
        (reto): SolicitudMixRow => ({
          kind: 'reto_directo',
          id: `pend-reto-${reto.id}`,
          item: reto,
          section: 'pendiente',
        })
      ),
    ].sort((a, b) => mixRowTimestamp(b) - mixRowTimestamp(a));

    if (pendientesMix.length > 0) {
      rows.push({
        kind: 'header',
        id: 'header-pendientes',
        title: 'Pendientes',
        subtitle: 'Solicitudes de piscina e invitaciones directas',
      });
      rows.push(...pendientesMix);
    }

    const historialMix: SolicitudMixRow[] = [
      ...solicitudesHistorial.map(
        (sol): SolicitudMixRow => ({
          kind: 'solicitud',
          id: `hist-sol-${sol.id}`,
          item: sol,
          section: 'historial',
        })
      ),
      ...retosHistorial.map(
        (reto): SolicitudMixRow => ({
          kind: 'reto_directo',
          id: `hist-reto-${reto.id}`,
          item: reto,
          section: 'historial',
        })
      ),
    ].sort((a, b) => mixRowTimestamp(b) - mixRowTimestamp(a));

    if (historialMix.length > 0) {
      rows.push({
        kind: 'header',
        id: 'header-historial',
        title: 'Historial',
        subtitle: 'Rechazadas y canceladas · confirmados en Reservas',
      });
      rows.push(...historialMix);
    }
    return rows;
  }, [solicitudesPendientes, solicitudesHistorial, retosPendientes, retosHistorial]);

  const listaVaciaReservas = seccion === 'reservas' && reservas.length === 0;
  const listaVaciaSolicitudes = seccion === 'solicitudes' && solicitudesFlatData.length === 0;

  const renderReservaItem = useCallback(
    ({ item: reserva }: { item: ReservaWithRelations }) => (
      <ReservaCard
        reserva={reserva}
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
    [estadoPartidoPorReservaId, handleCancelarReserva]
  );

  const renderSolicitudRow = useCallback(
    ({ item: row }: { item: SolicitudListRow }) => {
      if (row.kind === 'header') {
        return <SectionHeader title={row.title} subtitle={row.subtitle} />;
      }
      if (row.kind === 'reto_directo') {
        const reto = row.item;
        const esPendiente = row.section === 'pendiente';
        return (
          <RetoDirectoCard
            item={reto}
            destacado={esPendiente && reto.direccion === 'recibido'}
            procesando={procesandoRetoId === reto.id}
            onAceptar={
              esPendiente && reto.direccion === 'recibido' && reto.estado === 'pendiente'
                ? () => handleAceptarRetoDirecto(reto.id)
                : undefined
            }
            onRechazar={
              esPendiente && reto.direccion === 'recibido' && reto.estado === 'pendiente'
                ? () => handleRechazarRetoDirecto(reto.id)
                : undefined
            }
            onCancelar={
              esPendiente && reto.direccion === 'enviado' && reto.estado === 'pendiente'
                ? () => handleCancelarRetoDirecto(reto.id)
                : undefined
            }
          />
        );
      }
      const sol = row.item;
      const esPendiente = row.section === 'pendiente';
      return (
        <SolicitudPiscinaCard
          item={sol}
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
      noLeidosPorSolicitud,
      procesandoSolicitudId,
      procesandoRetoId,
      handleAbrirConversacion,
      handleAceptarSolicitud,
      handleRechazarSolicitud,
      handleAceptarRetoDirecto,
      handleRechazarRetoDirecto,
      handleCancelarRetoDirecto,
    ]
  );

  const listFooter = useMemo(() => {
    if (seccion === 'reservas' && loadingMoreReservas) {
      return (
        <View className="flex-row items-center justify-center gap-sm py-md">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption">Cargando más...</Text>
        </View>
      );
    }
    if (seccion === 'solicitudes' && loadingSolicitudes && solicitudesFlatData.length === 0) {
      return (
        <View className="flex-row items-center justify-center gap-sm py-md">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption">Cargando solicitudes...</Text>
        </View>
      );
    }
    return null;
  }, [seccion, loadingMoreReservas, loadingSolicitudes, solicitudesFlatData.length, colors.primary]);

  // BlurView en Card (glass) + removeClippedSubviews crashea al scroll en Android/New Arch.
  const flatListPerf = {
    initialNumToRender: 6,
    maxToRenderPerBatch: 6,
    windowSize: 8,
    removeClippedSubviews: false,
  } as const;

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlayerLoadingView message="Cargando..." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1">
      <View className="p-md border-b border-border-subtle dark:border-border-subtle-dark">
        <Text variant="h3">Mis Potras</Text>
        <Text variant="caption" className="mt-1">
          Tus canchas reservadas, solicitudes e invitaciones directas
        </Text>
      </View>

      <View className="px-md py-sm border-b border-border-subtle dark:border-border-subtle-dark">
        <View className="flex-row gap-sm">
          {(
            [
              { key: 'reservas' as const, label: 'Reservas', icon: 'calendar-outline' as const },
              { key: 'solicitudes' as const, label: 'Solicitudes', icon: 'mail-outline' as const },
            ] as const
          ).map(({ key, label, icon }) => {
            const activo = seccion === key;
            const badge = key === 'solicitudes' && badgeSolicitudesTab > 0 ? badgeSolicitudesTab : 0;
            return (
              <Pressable
                key={key}
                className={cn(
                  'flex-1 flex-row items-center justify-center gap-1.5 py-sm px-md rounded-lg border',
                  activo ? 'bg-primary border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
                )}
                onPress={() => setSeccion(key)}
              >
                <Ionicons name={icon} size={18} color={activo ? '#FFFFFF' : colors.text} />
                <Text variant={activo ? 'inverse' : 'body'} className="text-sm font-semibold">
                  {label}
                </Text>
                {badge > 0 && (
                  <View
                    className="min-w-[18px] h-[18px] rounded-full items-center justify-center px-1"
                    style={{ backgroundColor: activo ? '#FFFFFF' : colors.error }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: activo ? colors.primary : '#FFFFFF' }}
                    >
                      {badge > 9 ? '9+' : badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {seccion === 'reservas' && (
        <View className="py-sm border-b border-border-subtle dark:border-border-subtle-dark">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-md gap-sm">
            {(['todas', 'pendiente', 'completada', 'cancelada'] as FiltroEstadoReserva[]).map((estado) => (
              <Chip
                key={estado}
                active={filtroEstado === estado}
                label={estado === 'todas' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
                onPress={() => setFiltroEstado(estado)}
                className="mr-sm"
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View className="flex-1 min-h-0">
      {seccion === 'reservas' ? (
        <FlatList
          key={`reservas-${filtroEstado}`}
          style={{ flex: 1 }}
          contentContainerClassName={cn('p-md pb-xxl', listaVaciaReservas && 'flex-grow')}
          data={reservas}
          keyExtractor={(item) => item.id}
          renderItem={renderReservaItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          nestedScrollEnabled={Platform.OS === 'android'}
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
          style={{ flex: 1 }}
          contentContainerClassName={cn('p-md pb-xxl', listaVaciaSolicitudes && 'flex-grow')}
          data={solicitudesFlatData}
          keyExtractor={(item) => item.id}
          renderItem={renderSolicitudRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          nestedScrollEnabled={Platform.OS === 'android'}
          ListFooterComponent={listFooter}
          {...flatListPerf}
          ListEmptyComponent={
            <EmptyState
              variant="waitingPlayers"
              title="Sin solicitudes"
              text="Las solicitudes de piscina y los retos directos que envíes o recibas aparecerán aquí. Los rivales confirmados se ven en Reservas."
            />
          }
        />
      )}
      </View>

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
      </View>
    </Screen>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-sm mt-xs">
      <Text variant="label" className="font-bold">{title}</Text>
      {subtitle ? <Text variant="caption" className="mt-0.5">{subtitle}</Text> : null}
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
  estadoPartido,
  onCancelar,
  onBuscarRival,
}: {
  reserva: ReservaWithRelations;
  estadoPartido?: string;
  onCancelar: (id: string) => void;
  onBuscarRival?: () => void;
}) {
  const { colors } = useGlassTheme();
  const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
  const estadoColor = getEstadoColor(reserva.estado, colors);
  const esPendiente = reserva.estado === 'pendiente';
  const precio = (reserva.cancha as { precio_por_hora?: number })?.precio_por_hora || 0;
  const partidoEstado = getPartidoEstadoDisplay(estadoPartido, Boolean(reserva.rival), colors);

  return (
    <Card
      className={cn('mb-md', esPendiente && 'border-l-4')}
      style={{
        borderColor: esPendiente ? colors.primary + '40' : colors.borderSubtle,
        borderLeftColor: esPendiente ? colors.primary : undefined,
      }}
    >
      <View className="flex-row justify-between items-start mb-xs gap-sm">
        <View className="flex-1 min-w-0">
          <Text variant="h4">
            {(reserva.cancha as { nombre?: string })?.nombre || 'Cancha'}
          </Text>
          <Text variant="caption" className="mb-xs">
            {(reserva.cancha as { complejo?: { nombre?: string } })?.complejo?.nombre || 'Complejo'}
          </Text>
        </View>
        <View className="flex-row flex-wrap justify-end gap-1 shrink-0 max-w-[52%]">
          {partidoEstado ? <EstadoBadge text={partidoEstado.text} color={partidoEstado.color} /> : null}
          <EstadoBadge text={getEstadoTexto(reserva.estado)} color={estadoColor} />
        </View>
      </View>

      <InfoRow icon="calendar-outline" label="Fecha" value={fecha} />
      <InfoRow icon="time-outline" label="Hora" value={hora} />
      <InfoRow icon="cash-outline" label="Precio" value={formatCurrency(precio)} valueColor={colors.success} />
      {reserva.rival ? (
        <InfoRow icon="people-outline" label="Rival" value={reserva.rival.equipoNombre} />
      ) : null}

      {esPendiente && (
        <View className="flex-row mt-md gap-sm">
          {onBuscarRival && (
            <Button className="flex-1" onPress={onBuscarRival}>
              <View className="flex-row items-center gap-xs">
                <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                <Text variant="inverse" className="text-sm font-medium">
                  Buscar rival
                </Text>
              </View>
            </Button>
          )}
          <Button
            variant="outline"
            className={cn(!onBuscarRival && 'flex-1')}
            onPress={() => onCancelar(reserva.id)}
          >
            <View className="flex-row items-center gap-xs">
              <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              <Text className="text-sm font-medium" style={{ color: colors.error }}>
                Cancelar
              </Text>
            </View>
          </Button>
        </View>
      )}
    </Card>
  );
}

function RetoDirectoCard({
  item,
  onAceptar,
  onRechazar,
  onCancelar,
  destacado,
  procesando,
}: {
  item: RetoDirectoItem;
  onAceptar?: () => void;
  onRechazar?: () => void;
  onCancelar?: () => void;
  destacado?: boolean;
  procesando?: boolean;
}) {
  const { colors } = useGlassTheme();
  const fh = item.reservaFechaHora ? formatFechaHora(item.reservaFechaHora) : null;
  const estadoColor = getEstadoColor(item.estado, colors);
  const contrincante =
    item.direccion === 'enviado'
      ? `Invitaste a ${item.contrincanteNombre}`
      : `Invitación de ${item.contrincanteNombre}`;

  return (
    <Card
      className={cn('mb-md', destacado && 'border-l-4')}
      style={{
        borderColor: destacado ? colors.primary + '60' : colors.borderSubtle,
        borderLeftColor: destacado ? colors.primary : undefined,
      }}
    >
      <View className="flex-row justify-between items-start mb-xs">
        <View
          className="flex-row items-center gap-1 px-sm py-1 rounded-sm"
          style={{ backgroundColor: colors.primary + '20' }}
        >
          <Ionicons name="person-outline" size={14} color={colors.primary} />
          <Text variant="caption" className="font-bold" style={{ color: colors.primary }}>
            Reto directo
          </Text>
        </View>
        <View className="px-sm py-1 rounded-sm" style={{ backgroundColor: estadoColor + '20' }}>
          <Text variant="caption" className="font-semibold" style={{ color: estadoColor }}>
            {getEstadoTexto(item.estado)}
          </Text>
        </View>
      </View>
      <Text variant="h4" className="mt-xs">{contrincante}</Text>
      {item.canchaNombre && (
        <Text variant="caption" className="mb-xs">
          {item.canchaNombre}
          {item.complejoNombre ? ` · ${item.complejoNombre}` : ''}
        </Text>
      )}
      {fh && <InfoRow icon="calendar-outline" label="Partido" value={`${fh.fecha} · ${fh.hora}`} />}
      {item.mensaje ? (
        <Text variant="caption" className="italic mt-sm" numberOfLines={2}>
          {item.mensaje}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between mt-sm gap-sm">
        <DireccionBadge
          direccion={item.direccion === 'enviado' ? 'Invitación enviada' : 'Invitación recibida'}
        />
      </View>
      {(onAceptar || onRechazar || onCancelar) && (
        <View className="flex-row mt-md gap-sm">
          {onCancelar && (
            <Button variant="outline" className="flex-1" onPress={onCancelar} disabled={procesando} loading={procesando}>
              <View className="flex-row items-center gap-xs">
                {!procesando && <Ionicons name="close-outline" size={18} color={colors.error} />}
                <Text className="text-sm font-medium" style={{ color: colors.error }}>Cancelar</Text>
              </View>
            </Button>
          )}
          {onRechazar && (
            <Button variant="outline" className="flex-1" onPress={onRechazar} disabled={procesando} loading={procesando}>
              <View className="flex-row items-center gap-xs">
                {!procesando && <Ionicons name="close-outline" size={18} color={colors.error} />}
                <Text className="text-sm font-medium" style={{ color: colors.error }}>Rechazar</Text>
              </View>
            </Button>
          )}
          {onAceptar && (
            <Button
              className="flex-1"
              onPress={onAceptar}
              disabled={procesando}
              loading={procesando}
              style={{ backgroundColor: colors.success }}
            >
              <View className="flex-row items-center gap-xs">
                {!procesando && <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />}
                <Text variant="inverse" className="text-sm font-medium">Aceptar</Text>
              </View>
            </Button>
          )}
        </View>
      )}
    </Card>
  );
}

function SolicitudPiscinaCard({
  item,
  onPress,
  onAceptar,
  onRechazar,
  destacado,
  procesando,
  mensajesNoLeidos = 0,
}: {
  item: SolicitudRetoPiscinaItem;
  onPress?: () => void;
  onAceptar?: () => void;
  onRechazar?: () => void;
  destacado?: boolean;
  procesando?: boolean;
  mensajesNoLeidos?: number;
}) {
  const { colors } = useGlassTheme();
  const fh = item.reservaFechaHora ? formatFechaHora(item.reservaFechaHora) : null;
  const estadoColor = getEstadoColor(item.estado, colors);
  const contrincante =
    item.direccion === 'enviada'
      ? `A ${item.equipoAnfitrionNombre || 'anfitrión'}`
      : `De ${item.equipoSolicitanteNombre}`;

  const cardContent = (
    <>
      <View className="flex-row justify-between items-start mb-xs">
        <View
          className="flex-row items-center gap-1 px-sm py-1 rounded-sm"
          style={{ backgroundColor: colors.warning + '20' }}
        >
          <Ionicons name="football-outline" size={14} color={colors.warning} />
          <Text variant="caption" className="font-bold" style={{ color: colors.warning }}>
            Partido buscando rival
          </Text>
        </View>
        <View className="px-sm py-1 rounded-sm" style={{ backgroundColor: estadoColor + '20' }}>
          <Text variant="caption" className="font-semibold" style={{ color: estadoColor }}>
            {getEstadoTexto(item.estado)}
          </Text>
        </View>
      </View>
      <Text variant="h4" className="mt-xs">{contrincante}</Text>
      {item.canchaNombre && (
        <Text variant="caption" className="mb-xs">
          {item.canchaNombre}
          {item.complejoNombre ? ` · ${item.complejoNombre}` : ''}
        </Text>
      )}
      {fh && <InfoRow icon="calendar-outline" label="Partido" value={`${fh.fecha} · ${fh.hora}`} />}
      {item.mensaje ? (
        <Text variant="caption" className="italic mt-sm" numberOfLines={2}>
          {item.mensaje}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between mt-sm gap-sm">
        <DireccionBadge
          direccion={item.direccion === 'enviada' ? 'Solicitud enviada' : 'Solicitud recibida'}
        />
        {onPress && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
            <Text variant="caption" className="font-medium" style={{ color: colors.primary }}>
              Ver conversación
            </Text>
            {mensajesNoLeidos > 0 && (
              <View
                className="min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ml-0.5"
                style={{ backgroundColor: colors.error }}
              >
                <Text className="text-[10px] font-bold text-white">
                  {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      {(onAceptar || onRechazar) && (
        <View className="flex-row mt-md gap-sm">
          {onRechazar && (
            <Button variant="outline" className="flex-1" onPress={onRechazar} disabled={procesando} loading={procesando}>
              <View className="flex-row items-center gap-xs">
                {!procesando && <Ionicons name="close-outline" size={18} color={colors.error} />}
                <Text className="text-sm font-medium" style={{ color: colors.error }}>Rechazar</Text>
              </View>
            </Button>
          )}
          {onAceptar && (
            <Button
              className="flex-1"
              onPress={onAceptar}
              disabled={procesando}
              loading={procesando}
              style={{ backgroundColor: colors.success }}
            >
              <View className="flex-row items-center gap-xs">
                {!procesando && <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />}
                <Text variant="inverse" className="text-sm font-medium">Aceptar</Text>
              </View>
            </Button>
          )}
        </View>
      )}
    </>
  );

  const cardStyle = {
    borderColor: destacado ? colors.warning + '60' : colors.borderSubtle,
    borderLeftColor: destacado ? colors.warning : undefined,
  };

  if (onPress) {
    return (
      <Card onPress={onPress} className={cn('mb-md', destacado && 'border-l-4')} style={cardStyle}>
        {cardContent}
      </Card>
    );
  }

  return (
    <Card className={cn('mb-md', destacado && 'border-l-4')} style={cardStyle}>
      {cardContent}
    </Card>
  );
}

function DireccionBadge({ direccion }: { direccion: string }) {
  const { colors } = useGlassTheme();
  return (
    <View className="self-start px-sm py-1 rounded-sm" style={{ backgroundColor: colors.background }}>
      <Text variant="caption">{direccion}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors } = useGlassTheme();
  return (
    <View className="flex-row items-start gap-xs mt-xs">
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text variant="caption" className="font-medium">{label}:</Text>
      <Text variant="caption" className="flex-1" style={{ color: valueColor || colors.text }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

