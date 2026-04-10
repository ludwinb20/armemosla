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
  Alert,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import {
  obtenerPartidosJugador,
  obtenerPartidosAbiertos,
  crearPartidoAbierto,
  enviarSolicitudPartido,
  aceptarSolicitud,
  rechazarSolicitud,
  cancelarPartidoAbierto,
  filterPartidosPorRangoHorario,
  PartidoAbiertoWithRelations,
  SolicitudPartidoWithRelations,
} from '../../../lib/partidos';
import type { FiltrosPartidos } from '../../../lib/partidos';
import { obtenerReservasJugador, ReservaWithRelations } from '../../../lib/reservas';
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

type TabTipo = 'mis-partidos' | 'buscar-partidos';

export default function BuscarRivalScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    openCrear?: string | string[];
    reservaId?: string | string[];
    initialTab?: string | string[];
  }>();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const [tabActivo, setTabActivo] = useState<TabTipo>('mis-partidos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Datos
  const [misPartidos, setMisPartidos] = useState<PartidoAbiertoWithRelations[]>([]);
  const [partidosDisponiblesRaw, setPartidosDisponiblesRaw] = useState<PartidoAbiertoWithRelations[]>([]);
  const [misReservas, setMisReservas] = useState<ReservaWithRelations[]>([]);
  const [misEquipos, setMisEquipos] = useState<EquipoWithMembers[]>([]);

  const [explFechaDesdeText, setExplFechaDesdeText] = useState('');
  const [explFechaHastaText, setExplFechaHastaText] = useState('');
  const [explHoraInicio, setExplHoraInicio] = useState('00:00');
  const [explHoraFin, setExplHoraFin] = useState('23:59');
  const [vistaExplorar, setVistaExplorar] = useState<'lista' | 'mapa'>('lista');
  const [ubicacionActual, setUbicacionActual] = useState<{ lat: number; lng: number } | null>(null);

  const partidosDisponibles = useMemo(
    () => filterPartidosPorRangoHorario(partidosDisponiblesRaw, explHoraInicio, explHoraFin),
    [partidosDisponiblesRaw, explHoraInicio, explHoraFin]
  );
  
  // Modales
  const [showCrearPartido, setShowCrearPartido] = useState(false);
  const [showModalSolicitudes, setShowModalSolicitudes] = useState(false);
  const [partidoParaSolicitudes, setPartidoParaSolicitudes] = useState<PartidoAbiertoWithRelations | null>(null);
  
  // Form crear partido
  const [formReservaId, setFormReservaId] = useState('');
  const [formEquipoId, setFormEquipoId] = useState('');
  const [formJugadoresNecesarios, setFormJugadoresNecesarios] = useState<number>(5);
  const [formBuscaAutomatico, setFormBuscaAutomatico] = useState(false);
  
  // Form enviar solicitud
  const [showEnviarSolicitud, setShowEnviarSolicitud] = useState(false);
  const [partidoSolicitar, setPartidoSolicitar] = useState<PartidoAbiertoWithRelations | null>(null);
  const [solicitudEquipoId, setSolicitudEquipoId] = useState('');
  const [solicitudMensaje, setSolicitudMensaje] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();
  
  // Configurar notificaciones push
  usePushNotifications();

  useEffect(() => {
    const itab = Array.isArray(params.initialTab) ? params.initialTab[0] : params.initialTab;
    if (itab === 'buscar-partidos') {
      setTabActivo('buscar-partidos');
    }
    const open = params.openCrear === '1' || params.openCrear === 'true';
    const rid = Array.isArray(params.reservaId) ? params.reservaId[0] : params.reservaId;
    if (open && rid) {
      setTabActivo('mis-partidos');
      setFormReservaId(rid);
      setShowCrearPartido(true);
      router.setParams({ openCrear: undefined, reservaId: undefined });
    }
  }, [params.initialTab, params.openCrear, params.reservaId]);

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
    }, [tabActivo])
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
      
      if (tabActivo === 'mis-partidos') {
        const [partidos, reservas, equipos] = await Promise.all([
          obtenerPartidosJugador(),
          obtenerReservasJugador(),
          obtenerEquiposJugador(),
        ]);
        setMisPartidos(partidos);
        setMisReservas(reservas.filter(r => r.estado === 'pendiente'));
        setMisEquipos(equipos);
      } else {
        await loadExplorarPartidos();
        const equipos = await obtenerEquiposJugador();
        setMisEquipos(equipos);
      }
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      showError('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const aplicarFiltrosExplorar = async () => {
    if (tabActivo !== 'buscar-partidos') return;
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

  const handleCrearPartido = async () => {
    if (!formReservaId || !formEquipoId) {
      showError('Campos requeridos', 'Por favor completa todos los campos');
      return;
    }

    try {
      setLoading(true);
      await crearPartidoAbierto(formReservaId, formEquipoId, formJugadoresNecesarios, formBuscaAutomatico);
      showSuccess('Listo', 'Tu partido ya está en la piscina. Otros equipos pueden pedirte reto.');
      setShowCrearPartido(false);
      resetFormCrear();
      loadData();
    } catch (error: any) {
      console.error('Error al crear partido:', error);
      showError('Error', error.message || 'No se pudo crear el partido abierto');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarSolicitud = async () => {
    if (!partidoSolicitar || !solicitudEquipoId) {
      showError('Equipo requerido', 'Por favor selecciona un equipo');
      return;
    }

    try {
      setEnviandoSolicitud(true);
      await enviarSolicitudPartido(partidoSolicitar.id, solicitudEquipoId, solicitudMensaje || undefined);
      showSuccess('Reto enviado', 'El dueño de la reserva puede aceptarte o rechazarte.');
      setShowEnviarSolicitud(false);
      resetFormSolicitud();
      loadData();
    } catch (error: any) {
      console.error('Error al enviar solicitud:', error);
      showError('Error', error.message || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const handleAceptarSolicitud = async (solicitudId: string) => {
    try {
      await aceptarSolicitud(solicitudId);
      showSuccess('Reto aceptado', 'Ese partido ya no aparece en la piscina para los demás.');
      setShowModalSolicitudes(false);
      loadData();
    } catch (error: any) {
      console.error('Error al aceptar solicitud:', error);
      showError('Error', error.message || 'No se pudo aceptar la solicitud');
    }
  };

  const handleRechazarSolicitud = async (solicitudId: string) => {
    try {
      await rechazarSolicitud(solicitudId);
      showSuccess('Éxito', 'Solicitud rechazada');
      loadData();
    } catch (error: any) {
      console.error('Error al rechazar solicitud:', error);
      showError('Error', error.message || 'No se pudo rechazar la solicitud');
    }
  };

  const handleCancelarPartido = async (partidoId: string) => {
    showError(
      'Quitar de la piscina',
      '¿Seguro? Tu reserva sigue vigente, solo deja de mostrarse para que otros pidan reto.',
      () => {
        cancelarPartidoAsync(partidoId);
      },
      () => {},
      'Cancelar',
      'Confirmar'
    );
  };

  const cancelarPartidoAsync = async (partidoId: string) => {
    try {
      await cancelarPartidoAbierto(partidoId);
      showSuccess('Listo', 'Publicación quitada de la piscina');
      loadData();
    } catch (error: any) {
      console.error('Error al cancelar partido:', error);
      showError('Error', error.message || 'No se pudo cancelar el partido');
    }
  };

  const resetFormCrear = () => {
    setFormReservaId('');
    setFormEquipoId('');
    setFormJugadoresNecesarios(5);
    setFormBuscaAutomatico(false);
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

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return Colors.success;
      case 'cancelado':
        return Colors.error;
      case 'en_negociacion':
        return Colors.warning;
      case 'abierto':
      default:
        return Colors.primary;
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return 'Rival confirmado';
      case 'cancelado':
        return 'Cancelado';
      case 'en_negociacion':
        return 'En Negociación';
      case 'abierto':
      default:
        return 'Abierto';
    }
  };

  const reservasPendientes = misReservas.filter(r => r.estado === 'pendiente');

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
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
            <Text style={[styles.title, { color: colors.text }]}>Buscar rival</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            tabActivo === 'mis-partidos' && { borderBottomColor: Colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setTabActivo('mis-partidos')}
        >
          <Text
            style={[
              styles.tabText,
              { color: tabActivo === 'mis-partidos' ? Colors.primary : colors.textSecondary },
            ]}
          >
            Mi piscina
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            tabActivo === 'buscar-partidos' && { borderBottomColor: Colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setTabActivo('buscar-partidos')}
        >
          <Text
            style={[
              styles.tabText,
              { color: tabActivo === 'buscar-partidos' ? Colors.primary : colors.textSecondary },
            ]}
          >
            Pedir reto
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botón Crear Partido */}
      {tabActivo === 'mis-partidos' && (
        <View style={styles.createButtonContainer}>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: Colors.primary }]}
            onPress={() => setShowCrearPartido(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={Colors.textInverse} />
            <Text style={styles.createButtonText}>Publicar partido en la piscina</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contenido */}
      {tabActivo === 'mis-partidos' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {misPartidos.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nada en tu piscina</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Publicá una reserva pendiente para que otros equipos vean tu partido y pidan reto.
              </Text>
            </View>
          ) : (
            misPartidos.map((partido) => {
              const reserva = partido.reserva as any;
              const { fecha, hora } = formatFechaHora(reserva?.fecha_hora || '');
              const estadoColor = getEstadoColor(partido.estado);
              const solicitudesPendientes = partido.solicitudes?.filter(s => s.estado === 'pendiente') || [];

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
                    <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '20' }]}>
                      <Text style={[styles.estadoBadgeText, { color: estadoColor }]}>
                        {getEstadoTexto(partido.estado)}
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
                    {solicitudesPendientes.length > 0 && (
                      <View style={[styles.solicitudesBadge, { backgroundColor: Colors.warning + '20' }]}>
                        <Ionicons name="mail-outline" size={16} color={Colors.warning} />
                        <Text style={[styles.solicitudesText, { color: Colors.warning }]}>
                          {solicitudesPendientes.length} solicitud{solicitudesPendientes.length !== 1 ? 'es' : ''} pendiente{solicitudesPendientes.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.partidoActions}>
                    {solicitudesPendientes.length > 0 && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Colors.warning }]}
                        onPress={() => {
                          setPartidoParaSolicitudes(partido);
                          setShowModalSolicitudes(true);
                        }}
                      >
                        <Ionicons name="mail-outline" size={18} color={Colors.textInverse} />
                        <Text style={styles.actionButtonText}>Ver retos</Text>
                      </TouchableOpacity>
                    )}
                    {partido.estado === 'abierto' && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton, { borderColor: Colors.error }]}
                        onPress={() => handleCancelarPartido(partido.id)}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                        <Text style={[styles.actionButtonText, { color: Colors.error }]}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View style={styles.exploreOuter}>
          <View
            style={[
              styles.exploreToolbar,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.exploreToolbarTitle, { color: colors.text }]}>
              Partidos en la piscina (reservas de otros que buscan rival). Filtros de fecha y hora local.
            </Text>
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
                <View style={styles.emptyState}>
                  <Ionicons name="map-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin partidos en el mapa</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Ajustá filtros de fecha u hora o probá más tarde.
                  </Text>
                </View>
              ) : (
                <PartidosMapa
                  markers={partidosToMapMarkers(partidosDisponibles)}
                  ubicacionActual={ubicacionActual}
                  onMarkerPress={(partidoId) => {
                    const p = partidosDisponibles.find((x) => x.id === partidoId);
                    if (p) {
                      setPartidoSolicitar(p);
                      setShowEnviarSolicitud(true);
                    }
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
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>La piscina está vacía</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No hay publicaciones abiertas con estos filtros. Cuando alguien aparte cancha y publique, aparecerá acá.
                  </Text>
                </View>
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
                          onPress={() => {
                            setPartidoSolicitar(partido);
                            setShowEnviarSolicitud(true);
                          }}
                        >
                          <Ionicons name="send-outline" size={18} color={Colors.textInverse} />
                          <Text style={styles.actionButtonText}>Pedir reto</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Modal Crear Partido */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showCrearPartido}
        onBackdropPress={() => setShowCrearPartido(false)}
        onBackButtonPress={() => setShowCrearPartido(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Publicar en la piscina</Text>
              <TouchableOpacity onPress={() => setShowCrearPartido(false)}>
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
                <Text style={[styles.label, { color: colors.text }]}>Reserva *</Text>
                <ScrollView style={styles.reservasList}>
                  {reservasPendientes.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No tienes reservas pendientes
                    </Text>
                  ) : (
                    reservasPendientes.map((reserva) => {
                      const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
                      const cancha = reserva.cancha as any;

                      return (
                        <TouchableOpacity
                          key={reserva.id}
                          style={[
                            styles.reservaOption,
                            {
                              backgroundColor: formReservaId === reserva.id ? Colors.primary + '20' : colors.surface,
                              borderColor: formReservaId === reserva.id ? Colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => setFormReservaId(reserva.id)}
                        >
                          <Text style={[styles.reservaOptionText, { color: colors.text }]}>
                            {cancha?.nombre || 'Cancha'} - {fecha} {hora}
                          </Text>
                          {formReservaId === reserva.id && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Equipo *</Text>
                <ScrollView style={styles.equiposList}>
                  {misEquipos.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No tienes equipos. Crea uno en tu perfil.
                    </Text>
                  ) : (
                    misEquipos.map((equipo) => (
                      <TouchableOpacity
                        key={equipo.id}
                        style={[
                          styles.equipoOption,
                          {
                            backgroundColor: formEquipoId === equipo.id ? Colors.primary + '20' : colors.surface,
                            borderColor: formEquipoId === equipo.id ? Colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setFormEquipoId(equipo.id)}
                      >
                        <Text style={[styles.equipoOptionText, { color: colors.text }]}>{equipo.nombre}</Text>
                        {formEquipoId === equipo.id && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Jugadores necesarios *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={formJugadoresNecesarios.toString()}
                  onChangeText={(text) => setFormJugadoresNecesarios(parseInt(text) || 5)}
                  placeholder="5"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={[styles.switchRow, { borderColor: colors.border }]}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="flash-outline" size={20} color={colors.text} />
                    <Text style={[styles.switchText, { color: colors.text }]}>Buscar automáticamente</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.switch, formBuscaAutomatico && { backgroundColor: Colors.primary }]}
                    onPress={() => setFormBuscaAutomatico(!formBuscaAutomatico)}
                  >
                    {formBuscaAutomatico && (
                      <View style={styles.switchThumb} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                onPress={() => setShowCrearPartido(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: Colors.primary }]}
                onPress={handleCrearPartido}
                disabled={loading || !formReservaId || !formEquipoId}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Publicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal Solicitudes */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showModalSolicitudes}
        onBackdropPress={() => setShowModalSolicitudes(false)}
        onBackButtonPress={() => setShowModalSolicitudes(false)}
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Retos recibidos</Text>
              <TouchableOpacity onPress={() => setShowModalSolicitudes(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {partidoParaSolicitudes?.solicitudes && partidoParaSolicitudes.solicitudes.length > 0 ? (
                partidoParaSolicitudes.solicitudes
                  .filter((s) => s.estado === 'pendiente')
                  .map((solicitud) => {
                    const equipo = solicitud.equipo_solicitante as any;

                    return (
                      <View
                        key={solicitud.id}
                        style={[styles.solicitudCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={styles.solicitudHeader}>
                          <Text style={[styles.solicitudEquipo, { color: colors.text }]}>
                            {equipo?.nombre || 'Equipo'}
                          </Text>
                          <Text style={[styles.solicitudFecha, { color: colors.textSecondary }]}>
                            {new Date(solicitud.created_at).toLocaleDateString('es-HN')}
                          </Text>
                        </View>
                        {solicitud.mensaje && (
                          <Text style={[styles.solicitudMensaje, { color: colors.textSecondary }]}>
                            {solicitud.mensaje}
                          </Text>
                        )}
                        <View style={styles.solicitudActions}>
                          <TouchableOpacity
                            style={[styles.solicitudButton, styles.rechazarButton, { borderColor: Colors.error }]}
                            onPress={() => handleRechazarSolicitud(solicitud.id)}
                          >
                            <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                            <Text style={[styles.solicitudButtonText, { color: Colors.error }]}>Rechazar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.solicitudButton, styles.aceptarButton, { backgroundColor: Colors.success }]}
                            onPress={() => handleAceptarSolicitud(solicitud.id)}
                          >
                            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textInverse} />
                            <Text style={styles.solicitudButtonTextAceptar}>Aceptar reto</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="mail-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No hay retos pendientes
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal Enviar Solicitud */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showEnviarSolicitud}
        onBackdropPress={() => setShowEnviarSolicitud(false)}
        onBackButtonPress={() => setShowEnviarSolicitud(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Pedir reto</Text>
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
                      No tienes equipos. Crea uno en tu perfil.
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
                  placeholder="Escribe un mensaje para el equipo..."
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
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: Colors.primary }]}
                onPress={handleEnviarSolicitud}
                disabled={enviandoSolicitud || !solicitudEquipoId}
              >
                {enviandoSolicitud ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Enviar reto</Text>
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  tabText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  createButtonContainer: {
    padding: Spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  createButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
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
  estadoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  estadoBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
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
  solicitudesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  solicitudesText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
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
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textInverse,
  },
  modalSheetOuter: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
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
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reservasList: {
    maxHeight: 150,
  },
  reservaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  reservaOptionText: {
    fontSize: Typography.fontSize.md,
    flex: 1,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  switchText: {
    fontSize: Typography.fontSize.md,
    flex: 1,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.textInverse,
    alignSelf: 'flex-end',
  },
  solicitudCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  solicitudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  solicitudEquipo: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  solicitudFecha: {
    fontSize: Typography.fontSize.xs,
  },
  solicitudMensaje: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  solicitudActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  solicitudButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  rechazarButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  aceptarButton: {},
  solicitudButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  solicitudButtonTextAceptar: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textInverse,
  },
  exploreOuter: {
    flex: 1,
  },
  exploreToolbar: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  exploreToolbarTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs,
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
