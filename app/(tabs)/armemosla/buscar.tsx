import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { buscarCanchasPorUbicacion, buscarCanchasPorFiltros, CanchaBusqueda, FiltrosBusqueda, agruparCanchasPorComplejo, ComplejoBusqueda, obtenerCanchasDeComplejo } from '../../../lib/busqueda';
import { crearReservaJugador } from '../../../lib/reservas';
import { supabase } from '../../../lib/supabase';
import { useCustomAlert } from '../../../hooks/useCustomAlert';
import CustomAlert from '../../../components/CustomAlert';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useTheme } from '../../../contexts/ThemeContext';
import BusquedaMapa from '../../../components/BusquedaMapa';
import FechaHoraNativePickers from '../../../components/FechaHoraNativePickers';
import BusquedaLista from '../../../components/BusquedaLista';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../../../lib/rnModalPresets';
import { endOfBookingWindow } from '../../../lib/bookingWindow';

/** Franjas de reserva en minutos (coinciden con turnos típicos de cancha). */
const SLOT_MINUTES = 30;
const DEFAULT_EVENING_HOUR = 18;

function roundToSlot(date: Date): Date {
  const ms = SLOT_MINUTES * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

function defaultReservationDateTime(): Date {
  const evening = new Date();
  evening.setHours(DEFAULT_EVENING_HOUR, 0, 0, 0);
  evening.setSeconds(0, 0);
  let cand = roundToSlot(evening);
  if (cand.getTime() > Date.now()) return cand;
  let d = new Date();
  d.setSeconds(0, 0);
  d = roundToSlot(d);
  const minOk = new Date(Date.now() + 5 * 60 * 1000);
  while (d <= minOk) {
    d = new Date(d.getTime() + SLOT_MINUTES * 60 * 1000);
  }
  return d;
}

function applyDayOffsetKeepingTime(days: number, timeSource: Date | null): Date {
  const ref = timeSource ? new Date(timeSource) : defaultReservationDateTime();
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
  let out = roundToSlot(d);
  const minOk = new Date(Date.now() - 60 * 1000);
  while (out.getTime() < minOk.getTime()) {
    out = new Date(out.getTime() + SLOT_MINUTES * 60 * 1000);
  }
  return out;
}

function nextSaturdayEveningSlot(): Date {
  const d = new Date();
  const day = d.getDay();
  let add = (6 - day + 7) % 7;
  if (add === 0) {
    const target = new Date(d);
    target.setHours(DEFAULT_EVENING_HOUR, 0, 0, 0);
    target.setSeconds(0, 0);
    const t = roundToSlot(target);
    if (t.getTime() <= Date.now()) add = 7;
  }
  d.setDate(d.getDate() + add);
  d.setHours(DEFAULT_EVENING_HOUR, 0, 0, 0);
  d.setSeconds(0, 0);
  let out = roundToSlot(d);
  const minOk = new Date(Date.now() - 60 * 1000);
  while (out.getTime() < minOk.getTime()) {
    out = new Date(out.getTime() + SLOT_MINUTES * 60 * 1000);
  }
  return out;
}

type VistaTipo = 'mapa' | 'lista';

function BuscarScreen() {
  const { theme: appTheme } = useTheme();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ flow?: string | string[] }>();
  const flowRaw = Array.isArray(params.flow) ? params.flow[0] : params.flow;
  const flowConRival = flowRaw === 'con_rival';

  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const [vistaTipo, setVistaTipo] = useState<VistaTipo>('lista');
  const [loading, setLoading] = useState(false);
  const [canchas, setCanchas] = useState<CanchaBusqueda[]>([]);
  const [complejos, setComplejos] = useState<ComplejoBusqueda[]>([]);
  
  // Selector de fecha/hora
  const [fechaHora, setFechaHora] = useState<Date | null>(null);
  const [showFechaHoraModal, setShowFechaHoraModal] = useState(false);
  const [draftDateTime, setDraftDateTime] = useState<Date>(() => defaultReservationDateTime());
  
  // Ubicación
  const [ubicacionActual, setUbicacionActual] = useState<{ lat: number; lng: number } | null>(null);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  
  // Filtros (lista)
  const [filtroNombre, setFiltroNombre] = useState('');
  const [precioMin, setPrecioMin] = useState<number | undefined>();
  const [precioMax, setPrecioMax] = useState<number | undefined>();
  const [ordenarPor, setOrdenarPor] = useState<'precio' | 'distancia' | 'nombre'>('distancia');
  const [showFiltros, setShowFiltros] = useState(false);
  
  // Modal de detalles
  const [canchaSeleccionada, setCanchaSeleccionada] = useState<CanchaBusqueda | null>(null);
  const [showModalDetalle, setShowModalDetalle] = useState(false);
  
  // Modal de complejo (para vista de mapa)
  const [complejoSeleccionado, setComplejoSeleccionado] = useState<ComplejoBusqueda | null>(null);
  const [canchasComplejo, setCanchasComplejo] = useState<CanchaBusqueda[]>([]);
  const [fotosComplejo, setFotosComplejo] = useState<Array<{ id: string; foto_url: string; orden: number }>>([]);
  const [showModalComplejo, setShowModalComplejo] = useState(false);
  const [loadingComplejo, setLoadingComplejo] = useState(false);
  
  // Reserva
  const [reservando, setReservando] = useState(false);
  
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      obtenerUbicacionActual();
    }, [])
  );

  useEffect(() => {
    if (fechaHora) {
      buscar();
    }
  }, [fechaHora, vistaTipo, ordenarPor]);

  const obtenerUbicacionActual = async () => {
    try {
      setObteniendoUbicacion(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUbicacionActual({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error al obtener ubicación:', error);
    } finally {
      setObteniendoUbicacion(false);
    }
  };

  const buscar = async () => {
    if (!fechaHora) {
      showError('Fecha requerida', 'Por favor selecciona una fecha y hora para buscar canchas');
      return;
    }

    try {
      setLoading(true);
      let resultados: CanchaBusqueda[] = [];

      if (vistaTipo === 'mapa' && ubicacionActual) {
        // Búsqueda por ubicación
        resultados = await buscarCanchasPorUbicacion(
          ubicacionActual.lat,
          ubicacionActual.lng,
          fechaHora.toISOString(),
          50 // radio de 50km
        );
      } else {
        // Búsqueda por filtros
        const filtros: FiltrosBusqueda = {
          fechaHora: fechaHora.toISOString(),
          nombre: filtroNombre || undefined,
          precioMin,
          precioMax,
          lat: ubicacionActual?.lat,
          lng: ubicacionActual?.lng,
        };
        resultados = await buscarCanchasPorFiltros(filtros);
      }

      setCanchas(resultados);
      
      // Si es vista de mapa, agrupar por complejo
      if (vistaTipo === 'mapa') {
        const complejosAgrupados = agruparCanchasPorComplejo(resultados);
        // Obtener fotos de complejos
        const complejosConFotos = await Promise.all(
          complejosAgrupados.map(async (complejo) => {
            const { data: fotos } = await supabase
              .from('complejo_fotos')
              .select('id, foto_url, orden')
              .eq('complejo_id', complejo.id)
              .order('orden', { ascending: true });
            return { ...complejo, fotos: fotos || [] };
          })
        );
        setComplejos(complejosConFotos);
      } else {
        setComplejos([]);
      }
    } catch (error: any) {
      console.error('Error al buscar canchas:', error);
      showError('Error', 'No se pudieron cargar las canchas');
    } finally {
      setLoading(false);
    }
  };

  const handleReservar = async (cancha: CanchaBusqueda) => {
    if (!cancha.disponible) {
      showError('No disponible', 'Esta cancha no está disponible en el horario seleccionado');
      return;
    }

    if (!fechaHora) {
      showError('Fecha requerida', 'Por favor selecciona una fecha y hora');
      return;
    }

    try {
      setReservando(true);
      const nuevaReserva = await crearReservaJugador(cancha.id, fechaHora.toISOString());
      setShowModalDetalle(false);
      buscar(); // Recargar para actualizar disponibilidad
      if (flowConRival && nuevaReserva?.id) {
        showSuccess(
          'Reserva lista',
          'Siguiente paso: publicar tu partido en la piscina para que otros equipos puedan pedirte reto.'
        );
        router.push({
          pathname: '/(tabs)/armemosla/buscar-rival',
          params: { openCrear: '1', reservaId: nuevaReserva.id },
        });
      } else {
        showSuccess('Éxito', 'Reserva creada correctamente');
      }
    } catch (error: any) {
      console.error('Error al crear reserva:', error);
      showError('Error', error.message || 'No se pudo crear la reserva');
    } finally {
      setReservando(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatFechaHora = (fecha: Date) => {
    return {
      fecha: fecha.toLocaleDateString('es-HN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      hora: fecha.toLocaleTimeString('es-HN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const openFechaHoraModal = () => {
    setDraftDateTime(fechaHora ? new Date(fechaHora) : defaultReservationDateTime());
    setShowFechaHoraModal(true);
  };

  const pickQuickDateToDraft = (kind: 'today' | 'tomorrow' | 'plus2' | 'sat') => {
    let next: Date;
    if (kind === 'today') next = applyDayOffsetKeepingTime(0, draftDateTime);
    else if (kind === 'tomorrow') next = applyDayOffsetKeepingTime(1, draftDateTime);
    else if (kind === 'plus2') next = applyDayOffsetKeepingTime(2, draftDateTime);
    else next = nextSaturdayEveningSlot();
    setDraftDateTime(next);
  };

  const applyQuickHourToDraft = (hour: number, minute: number) => {
    const base = new Date(draftDateTime);
    base.setHours(hour, minute, 0, 0);
    setDraftDateTime(roundToSlot(base));
  };

  const confirmFechaHora = () => {
    const v = roundToSlot(draftDateTime);
    if (v.getTime() < Date.now() - 60 * 1000) {
      showError('Fecha u hora inválida', 'Elegí un momento a partir de ahora.');
      return;
    }
    const max = endOfBookingWindow();
    if (v.getTime() > max.getTime()) {
      showError(
        'Fecha fuera de rango',
        'Podés reservar como máximo con 3 meses de anticipación desde hoy.'
      );
      return;
    }
    setFechaHora(v);
    setShowFechaHoraModal(false);
  };

  const EVENING_HOURS = [17, 18, 19, 20, 21, 22];

  const handleCanchaPress = (cancha: CanchaBusqueda) => {
    setCanchaSeleccionada(cancha);
    setShowModalDetalle(true);
  };


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
            <Text style={[styles.title, { color: colors.text }]}>Buscar Canchas</Text>
            {flowConRival ? (
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Paso 1: elegí fecha, hora y cancha. Después podrás buscar rival.
              </Text>
            ) : flowRaw === 'solo' ? (
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Reservá la cancha que prefieras.
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Fecha y hora: un solo control abre el modal */}
      <View style={[styles.fechaHoraContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.fechaHoraSingle, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={openFechaHoraModal}
          activeOpacity={0.85}
        >
          <View style={styles.fechaHoraSingleIcon}>
            <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
          </View>
          <View style={styles.fechaHoraSingleText}>
            {fechaHora ? (
              <>
                <Text style={[styles.fechaHoraLinePrimary, { color: colors.text }]}>
                  {formatFechaHora(fechaHora).fecha}
                </Text>
                <View style={styles.fechaHoraLineRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.fechaHoraLineSecondary, { color: colors.textSecondary }]}>
                    {formatFechaHora(fechaHora).hora}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[styles.fechaHoraLinePrimary, { color: colors.textSecondary }]}>
                Tocá para elegir fecha y hora del partido
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Toggle Mapa/Lista y Botón Ubicación */}
      <View style={[styles.controlsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: vistaTipo === 'lista' ? Colors.primary : colors.background },
            ]}
            onPress={() => setVistaTipo('lista')}
          >
            <Ionicons
              name="list-outline"
              size={20}
              color={vistaTipo === 'lista' ? Colors.textInverse : colors.text}
            />
            <Text
              style={[
                styles.toggleButtonText,
                { color: vistaTipo === 'lista' ? Colors.textInverse : colors.text },
              ]}
            >
              Lista
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: vistaTipo === 'mapa' ? Colors.primary : colors.background },
            ]}
            onPress={() => setVistaTipo('mapa')}
          >
            <Ionicons
              name="map-outline"
              size={20}
              color={vistaTipo === 'mapa' ? Colors.textInverse : colors.text}
            />
            <Text
              style={[
                styles.toggleButtonText,
                { color: vistaTipo === 'mapa' ? Colors.textInverse : colors.text },
              ]}
            >
              Mapa
            </Text>
          </TouchableOpacity>
        </View>

        {vistaTipo === 'mapa' && (
          <TouchableOpacity
            style={[styles.ubicacionButton, { backgroundColor: Colors.primary }]}
            onPress={obtenerUbicacionActual}
            disabled={obteniendoUbicacion}
          >
            {obteniendoUbicacion ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Ionicons name="locate-outline" size={20} color={Colors.textInverse} />
            )}
          </TouchableOpacity>
        )}

        {vistaTipo === 'lista' && (
          <TouchableOpacity
            style={[styles.filtrosButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowFiltros(!showFiltros)}
          >
            <Ionicons name="filter-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros (Lista) */}
      {vistaTipo === 'lista' && showFiltros && (
        <View style={[styles.filtrosPanel, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.filtroRow}>
            <Text style={[styles.filtroLabel, { color: colors.text }]}>Buscar:</Text>
            <TextInput
              style={[styles.filtroInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={filtroNombre}
              onChangeText={setFiltroNombre}
              placeholder="Nombre de cancha o complejo"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.filtroRow}>
            <Text style={[styles.filtroLabel, { color: colors.text }]}>Precio min:</Text>
            <TextInput
              style={[styles.filtroInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={precioMin?.toString() || ''}
              onChangeText={(text) => setPrecioMin(text ? parseFloat(text) : undefined)}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.filtroRow}>
            <Text style={[styles.filtroLabel, { color: colors.text }]}>Precio max:</Text>
            <TextInput
              style={[styles.filtroInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={precioMax?.toString() || ''}
              onChangeText={(text) => setPrecioMax(text ? parseFloat(text) : undefined)}
              placeholder="999999"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.filtroRow}>
            <Text style={[styles.filtroLabel, { color: colors.text }]}>Ordenar por:</Text>
            <View style={styles.ordenarButtons}>
              {(['precio', 'distancia', 'nombre'] as const).map((opcion) => (
                <TouchableOpacity
                  key={opcion}
                  style={[
                    styles.ordenarButton,
                    {
                      backgroundColor: ordenarPor === opcion ? Colors.primary : colors.background,
                      borderColor: ordenarPor === opcion ? Colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setOrdenarPor(opcion)}
                >
                  <Text
                    style={[
                      styles.ordenarButtonText,
                      { color: ordenarPor === opcion ? Colors.textInverse : colors.text },
                    ]}
                  >
                    {opcion === 'precio' ? 'Precio' : opcion === 'distancia' ? 'Distancia' : 'Nombre'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Contenido: Mapa o Lista */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Buscando canchas...</Text>
        </View>
      ) : !fechaHora ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Selecciona fecha y hora</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Para buscar canchas disponibles, primero selecciona la fecha y hora deseada
          </Text>
        </View>
      ) : vistaTipo === 'mapa' ? (
        <BusquedaMapa
          complejos={complejos}
          ubicacionActual={ubicacionActual}
          onMarkerPress={async (complejo) => {
            setComplejoSeleccionado(complejo);
            setLoadingComplejo(true);
            setShowModalComplejo(true);
            try {
              if (!fechaHora) return;
              const { canchas: canchasDelComplejo, fotosComplejo: fotos } = await obtenerCanchasDeComplejo(
                complejo.id,
                fechaHora.toISOString()
              );
              setCanchasComplejo(canchasDelComplejo);
              setFotosComplejo(fotos);
            } catch (error: any) {
              console.error('Error al cargar canchas del complejo:', error);
              showError('Error', 'No se pudieron cargar las canchas del complejo');
            } finally {
              setLoadingComplejo(false);
            }
          }}
        />
      ) : (
        <BusquedaLista
          canchas={canchas}
          onCanchaPress={(cancha) => {
            setCanchaSeleccionada(cancha);
            setShowModalDetalle(true);
          }}
          onVerMapa={(cancha) => {
            setVistaTipo('mapa');
            // Buscar el complejo correspondiente y hacer scroll
            const complejo = complejos.find(c => c.id === cancha.complejo.id);
            if (complejo) {
              setTimeout(() => {
                setComplejoSeleccionado(complejo);
                setShowModalComplejo(true);
                obtenerCanchasDeComplejo(complejo.id, fechaHora?.toISOString() || new Date().toISOString())
                  .then(({ canchas: canchasDelComplejo, fotosComplejo: fotos }) => {
                    setCanchasComplejo(canchasDelComplejo);
                    setFotosComplejo(fotos);
                  })
                  .catch((error) => {
                    console.error('Error:', error);
                    showError('Error', 'No se pudieron cargar las canchas del complejo');
                  });
              }, 500);
            }
          }}
        />
      )}

      {/* Modal único: fecha + hora (lista y grilla, sin módulos nativos) */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showFechaHoraModal}
        onBackdropPress={() => setShowFechaHoraModal(false)}
        onBackButtonPress={() => setShowFechaHoraModal(false)}
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Fecha y hora</Text>
              <TouchableOpacity onPress={() => setShowFechaHoraModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                Elegí día y hora con los atajos o los selectores. Podés reservar hasta con 3 meses de
                anticipación. Turnos cada {SLOT_MINUTES} minutos (6:00–23:00).
              </Text>
              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Día rápido</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => pickQuickDateToDraft('today')}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>Hoy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => pickQuickDateToDraft('tomorrow')}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>Mañana</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => pickQuickDateToDraft('plus2')}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>En 2 días</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => pickQuickDateToDraft('sat')}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>Próx. sábado</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Hora habitual</Text>
              <View style={styles.chipRow}>
                {EVENING_HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => applyQuickHourToDraft(h, 0)}
                  >
                    <Text style={[styles.chipText, { color: colors.text }]}>
                      {`${h.toString().padStart(2, '0')}:00`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Fecha</Text>
              <FechaHoraNativePickers
                part="date"
                draftDateTime={draftDateTime}
                setDraftDateTime={setDraftDateTime}
                pickerTheme={appTheme}
                weekdayLabelColor={colors.text}
                shellStyle={[styles.pickerShell, { backgroundColor: colors.surface }]}
              />

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Hora</Text>
              <FechaHoraNativePickers
                part="time"
                draftDateTime={draftDateTime}
                setDraftDateTime={setDraftDateTime}
                pickerTheme={appTheme}
                shellStyle={[styles.pickerShell, { backgroundColor: colors.surface }]}
              />

              <View style={[styles.modalActionsRow, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.modalButtonFlex, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => setShowFechaHoraModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButtonFlex, { backgroundColor: Colors.primary }]}
                  onPress={confirmFechaHora}
                >
                  <Text style={styles.modalButtonTextReservar}>Listo</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal Detalle Cancha */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showModalDetalle}
        onBackdropPress={() => setShowModalDetalle(false)}
        onBackButtonPress={() => setShowModalDetalle(false)}
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Detalles de Cancha</Text>
              <TouchableOpacity onPress={() => setShowModalDetalle(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {canchaSeleccionada && (
              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerStyle={styles.modalBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {/* Fotos de la cancha */}
                {canchaSeleccionada.fotos && canchaSeleccionada.fotos.length > 0 && (
                  <ScrollView horizontal style={styles.fotosScroll} showsHorizontalScrollIndicator={false}>
                    {canchaSeleccionada.fotos.map((foto) => (
                      <Image
                        key={foto.id}
                        source={{ uri: foto.foto_url }}
                        style={styles.fotoComplejo}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                )}
                
                <Text style={[styles.modalLabel, { color: colors.text }]}>Nombre</Text>
                <Text style={[styles.modalValue, { color: colors.text }]}>{canchaSeleccionada.nombre}</Text>

                <Text style={[styles.modalLabel, { color: colors.text }]}>Complejo</Text>
                <Text style={[styles.modalValue, { color: colors.text }]}>{canchaSeleccionada.complejo.nombre}</Text>

                {canchaSeleccionada.complejo.direccion_texto && (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.text }]}>Dirección</Text>
                    <Text style={[styles.modalValue, { color: colors.text }]}>
                      {canchaSeleccionada.complejo.direccion_texto}
                    </Text>
                  </>
                )}

                <View style={styles.modalRow}>
                  <View style={styles.modalRowItem}>
                    <Text style={[styles.modalLabel, { color: colors.text }]}>Precio</Text>
                    <Text style={[styles.modalValue, { color: Colors.success }]}>
                      {formatCurrency(canchaSeleccionada.precio_por_hora)}
                    </Text>
                  </View>
                  <View style={styles.modalRowItem}>
                    <Text style={[styles.modalLabel, { color: colors.text }]}>Jugadores</Text>
                    <Text style={[styles.modalValue, { color: colors.text }]}>
                      {canchaSeleccionada.jugadores_por_equipo} por equipo
                    </Text>
                  </View>
                </View>

                {canchaSeleccionada.distancia !== undefined && (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.text }]}>Distancia</Text>
                    <Text style={[styles.modalValue, { color: colors.text }]}>
                      {canchaSeleccionada.distancia.toFixed(1)} km
                    </Text>
                  </>
                )}

                <View
                  style={[
                    styles.modalEstadoBadge,
                    {
                      backgroundColor: canchaSeleccionada.disponible
                        ? Colors.success + '20'
                        : Colors.error + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalEstadoText,
                      {
                        color: canchaSeleccionada.disponible ? Colors.success : Colors.error,
                      },
                    ]}
                  >
                    {canchaSeleccionada.disponible ? '✓ Disponible' : '✗ No disponible'}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                onPress={() => setShowModalDetalle(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cerrar</Text>
              </TouchableOpacity>
              {canchaSeleccionada?.disponible && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonReservar, { backgroundColor: Colors.primary }]}
                  onPress={() => canchaSeleccionada && handleReservar(canchaSeleccionada)}
                  disabled={reservando}
                >
                  {reservando ? (
                    <ActivityIndicator size="small" color={Colors.textInverse} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textInverse} />
                      <Text style={styles.modalButtonTextReservar}>Reservar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal Complejo (Canchas) */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showModalComplejo}
        onBackdropPress={() => setShowModalComplejo(false)}
        onBackButtonPress={() => setShowModalComplejo(false)}
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitle}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {complejoSeleccionado?.nombre}
                </Text>
                {complejoSeleccionado?.direccion_texto && (
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {complejoSeleccionado.direccion_texto}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowModalComplejo(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Fotos del complejo */}
            {fotosComplejo.length > 0 && (
              <ScrollView horizontal style={styles.fotosScroll} showsHorizontalScrollIndicator={false}>
                {fotosComplejo.map((foto) => (
                  <Image
                    key={foto.id}
                    source={{ uri: foto.foto_url }}
                    style={styles.fotoComplejo}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {loadingComplejo ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Cargando canchas...
                  </Text>
                </View>
              ) : canchasComplejo.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="football-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay canchas</Text>
                </View>
              ) : (
                canchasComplejo.map((cancha) => (
                  <TouchableOpacity
                    key={cancha.id}
                    style={[
                      styles.canchaItem,
                      {
                        backgroundColor: colors.surface,
                        borderColor: cancha.disponible ? Colors.success + '40' : colors.border,
                        borderLeftWidth: cancha.disponible ? 4 : 1,
                      },
                      !cancha.disponible && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      setCanchaSeleccionada(cancha);
                      setShowModalComplejo(false);
                      setShowModalDetalle(true);
                    }}
                  >
                    {/* Foto de la cancha */}
                    {cancha.fotos && cancha.fotos.length > 0 && (
                      <Image
                        source={{ uri: cancha.fotos[0].foto_url }}
                        style={styles.canchaItemFoto}
                        resizeMode="cover"
                      />
                    )}
                    
                    <View style={styles.canchaItemContent}>
                      <View style={styles.canchaItemHeader}>
                        <Text style={[styles.canchaItemNombre, { color: colors.text }]}>
                          {cancha.nombre}
                        </Text>
                        <View
                          style={[
                            styles.estadoBadge,
                            {
                              backgroundColor: cancha.disponible
                                ? Colors.success + '20'
                                : Colors.error + '20',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.estadoBadgeText,
                              {
                                color: cancha.disponible ? Colors.success : Colors.error,
                              },
                            ]}
                          >
                            {cancha.disponible ? 'Disponible' : 'No disponible'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.canchaItemInfo}>
                        <View style={styles.canchaItemRow}>
                          <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.canchaItemLabel, { color: colors.textSecondary }]}>
                            Precio:
                          </Text>
                          <Text style={[styles.canchaItemValue, { color: Colors.success }]}>
                            {formatCurrency(cancha.precio_por_hora)}
                          </Text>
                        </View>
                        <View style={styles.canchaItemRow}>
                          <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.canchaItemLabel, { color: colors.textSecondary }]}>
                            Jugadores:
                          </Text>
                          <Text style={[styles.canchaItemValue, { color: colors.text }]}>
                            {cancha.jugadores_por_equipo} por equipo
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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

export default BuscarScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headerBack: {
    padding: Spacing.xs,
    marginTop: 2,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  fechaHoraContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  fechaHoraSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  fechaHoraSingleIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fechaHoraSingleText: {
    flex: 1,
    minWidth: 0,
  },
  fechaHoraLinePrimary: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'capitalize',
  },
  fechaHoraLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  fechaHoraLineSecondary: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 2,
    gap: 2,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  toggleButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  ubicacionButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtrosButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filtrosPanel: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  filtroRow: {
    gap: Spacing.xs,
  },
  filtroLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  filtroInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: Typography.fontSize.md,
  },
  ordenarButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ordenarButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  ordenarButtonText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
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
    color: Colors.textSecondary,
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
  modalBodyContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalHint: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  chipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalSectionLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pickerShell: {
    alignSelf: 'stretch',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  modalButtonFlex: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  modalValue: {
    fontSize: Typography.fontSize.md,
    marginBottom: Spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalRowItem: {
    flex: 1,
  },
  modalEstadoBadge: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  modalEstadoText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
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
  modalButtonReservar: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  modalButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalButtonTextReservar: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
  modalHeaderTitle: {
    flex: 1,
  },
  modalSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: 4,
  },
  fotosScroll: {
    maxHeight: 200,
  },
  fotoComplejo: {
    width: 300,
    height: 200,
    marginRight: Spacing.sm,
  },
  canchaItem: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  canchaItemFoto: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.border,
  },
  canchaItemContent: {
    padding: Spacing.md,
  },
  canchaItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  canchaItemNombre: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  canchaItemInfo: {
    gap: Spacing.xs,
  },
  canchaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  canchaItemLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  canchaItemValue: {
    fontSize: Typography.fontSize.sm,
    flex: 1,
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
});
