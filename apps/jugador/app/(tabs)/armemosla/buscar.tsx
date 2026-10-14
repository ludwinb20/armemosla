import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import RNModal from 'react-native-modal';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Spacing } from '../../../constants/theme';
import { buscarCanchasPorUbicacion, buscarCanchasPorFiltros, CanchaBusqueda, FiltrosBusqueda, agruparCanchasPorComplejo, ComplejoBusqueda, obtenerCanchasDeComplejo, obtenerFotosPorComplejos } from '../../../lib/busqueda';
import { crearReservaJugador } from '../../../lib/reservas';
import { useCustomAlert } from '../../../hooks/useCustomAlert';
import CustomAlert from '../../../components/CustomAlert';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { useTheme } from '../../../contexts/ThemeContext';
import { Screen, Text, Button, Input, Surface, Chip, DialogSheet } from '@/components/ui';
import { cn } from '@/lib/cn';
import BusquedaMapa from '../../../components/BusquedaMapa';
import FechaHoraNativePickers from '../../../components/FechaHoraNativePickers';
import BusquedaLista from '../../../components/BusquedaLista';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../../components/lottie/PlayerEmptyState';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimCenter,
} from '../../../lib/rnModalPresets';
import {
  endOfBookingWindow,
  snapToNearestWholeHour,
  getEarliestAllowedHourToday,
} from '../../../lib/bookingWindow';
import { formatFechaHoraDisplay, dateToUtcIsoHN } from '../../../lib/fechaHora';
import PublicarPartidoModal from '../../../components/PublicarPartidoModal';

const DEFAULT_EVENING_HOUR = 18;

/** Estilos del shell de FechaHoraNativePickers — no modificar (bloque visual intacto). */
const PICKER_SHELL = {
  alignSelf: 'stretch' as const,
  borderRadius: 8,
  overflow: 'hidden' as const,
  marginBottom: 16,
};
const PICKER_SHELL_TIME = {
  alignSelf: 'center' as const,
  maxWidth: 280,
  width: '100%' as const,
  borderRadius: 8,
  overflow: 'hidden' as const,
  marginBottom: 16,
};

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Próxima fecha/hora válida; prioriza 6:00 p. m. Si es hoy, respeta la primera hora permitida (≥ ahora + 1 h en punto). */
function defaultReservationDateTime(): Date {
  const now = new Date();
  const maxDate = endOfBookingWindow();

  for (let dayOffset = 0; dayOffset < 120; dayOffset++) {
    const cal = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    cal.setHours(0, 0, 0, 0);

    const atSix = new Date(cal);
    atSix.setHours(DEFAULT_EVENING_HOUR, 0, 0, 0);
    atSix.setSeconds(0, 0);
    atSix.setMilliseconds(0);

    if (atSix.getTime() > maxDate.getTime()) {
      break;
    }

    if (isSameCalendarDay(cal, now)) {
      const minToday = getEarliestAllowedHourToday(now);
      if (minToday === null) {
        continue;
      }
      if (atSix.getTime() >= minToday.getTime()) {
        return atSix;
      }
      return minToday;
    }

    return atSix;
  }

  const fallback = getEarliestAllowedHourToday(now);
  return fallback ?? snapToNearestWholeHour(now);
}

type VistaTipo = 'mapa' | 'lista';

function BuscarScreen() {
  const { theme: appTheme } = useTheme();
  const { colors } = useGlassTheme();
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
  const [showPublicarModal, setShowPublicarModal] = useState(false);
  const [reservaIdParaPublicar, setReservaIdParaPublicar] = useState<string | undefined>();
  
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
  }, [fechaHora, ubicacionActual?.lat, ubicacionActual?.lng]);

  useEffect(() => {
    if (vistaTipo !== 'mapa' || canchas.length === 0) {
      if (vistaTipo !== 'mapa') {
        setComplejos([]);
      }
      return;
    }

    let cancelled = false;

    (async () => {
      const agrupados = agruparCanchasPorComplejo(canchas);
      const fotosMap = await obtenerFotosPorComplejos(agrupados.map((c) => c.id));
      if (cancelled) return;

      setComplejos(
        agrupados.map((complejo) => ({
          ...complejo,
          fotos: fotosMap.get(complejo.id) || [],
        }))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [vistaTipo, canchas]);

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
          dateToUtcIsoHN(fechaHora),
          50 // radio de 50km
        );
      } else {
        // Búsqueda por filtros
        const filtros: FiltrosBusqueda = {
          fechaHora: dateToUtcIsoHN(fechaHora),
          nombre: filtroNombre || undefined,
          precioMin,
          precioMax,
          lat: ubicacionActual?.lat,
          lng: ubicacionActual?.lng,
        };
        resultados = await buscarCanchasPorFiltros(filtros);
      }

      setCanchas(resultados);
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
      const nuevaReserva = await crearReservaJugador(cancha.id, dateToUtcIsoHN(fechaHora));
      setShowModalDetalle(false);
      buscar(); // Recargar para actualizar disponibilidad
      if (flowConRival && nuevaReserva?.id) {
        setReservaIdParaPublicar(nuevaReserva.id);
        setShowPublicarModal(true);
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

  const formatFechaHora = (fecha: Date) =>
    formatFechaHoraDisplay(fecha.toISOString());

  const openFechaHoraModal = () => {
    const base = fechaHora ? new Date(fechaHora) : defaultReservationDateTime();
    setDraftDateTime(snapToNearestWholeHour(base));
    setShowFechaHoraModal(true);
  };

  const confirmFechaHora = () => {
    const v = snapToNearestWholeHour(draftDateTime);
    const ahora = new Date();
    if (isSameCalendarDay(v, ahora)) {
      const minHoy = getEarliestAllowedHourToday(ahora);
      if (minHoy === null) {
        showError(
          'Sin horarios para hoy',
          'Ya no quedan turnos en hora en punto para el día de hoy. Elegí otra fecha.'
        );
        return;
      }
      if (v.getTime() < minHoy.getTime()) {
        showError(
          'Hora inválida para hoy',
          'Tenés que elegir al menos una hora después de la próxima hora en punto (una hora después de ahora).'
        );
        return;
      }
    }
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

  const handleCanchaPress = (cancha: CanchaBusqueda) => {
    setCanchaSeleccionada(cancha);
    setShowModalDetalle(true);
  };


  return (
    <Screen edges={['top', 'bottom']}>
      <View className="p-md border-b border-border-subtle dark:border-border-subtle-dark">
        <View className="flex-row items-start gap-sm">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/armemosla'))}
            className="p-xs mt-0.5"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Volver a Armemosla"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text variant="h3">Buscar Canchas</Text>
            {flowConRival ? (
              <Text variant="caption" className="mt-xs leading-5">
                Paso 1: elegí fecha, hora y cancha. Después podrás buscar rival.
              </Text>
            ) : flowRaw === 'solo' ? (
              <Text variant="caption" className="mt-xs leading-5">
                Reservá la cancha que prefieras.
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <Surface variant="solid" className="p-md border-b border-border-subtle dark:border-border-subtle-dark">
        <Pressable
          className="flex-row items-center p-md rounded-lg border border-border-subtle dark:border-border-subtle-dark gap-md"
          style={{ backgroundColor: colors.background }}
          onPress={openFechaHoraModal}
        >
          <View
            className="w-11 h-11 rounded-lg items-center justify-center"
            style={{ backgroundColor: colors.primary + '18' }}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </View>
          <View className="flex-1 min-w-0">
            {fechaHora ? (
              <>
                <Text variant="body" className="font-semibold capitalize">
                  {formatFechaHora(fechaHora).fecha}
                </Text>
                <View className="flex-row items-center gap-xs mt-1">
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text variant="caption" className="font-medium">
                    {formatFechaHora(fechaHora).hora}
                  </Text>
                </View>
              </>
            ) : (
              <Text variant="bodySecondary">Tocá para elegir fecha y hora del partido</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </Pressable>
      </Surface>

      <Surface variant="solid" className="flex-row items-center p-md gap-sm border-b border-border-subtle dark:border-border-subtle-dark">
        <View className="flex-row flex-1 rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: colors.borderSubtle }}>
          <Pressable
            className={cn(
              'flex-1 flex-row items-center justify-center py-sm rounded-sm gap-xs',
              vistaTipo === 'lista' && 'bg-primary'
            )}
            onPress={() => setVistaTipo('lista')}
          >
            <Ionicons name="list-outline" size={20} color={vistaTipo === 'lista' ? '#FFFFFF' : colors.text} />
            <Text variant={vistaTipo === 'lista' ? 'inverse' : 'body'} className="text-sm font-medium">
              Lista
            </Text>
          </Pressable>
          <Pressable
            className={cn(
              'flex-1 flex-row items-center justify-center py-sm rounded-sm gap-xs',
              vistaTipo === 'mapa' && 'bg-primary'
            )}
            onPress={() => setVistaTipo('mapa')}
          >
            <Ionicons name="map-outline" size={20} color={vistaTipo === 'mapa' ? '#FFFFFF' : colors.text} />
            <Text variant={vistaTipo === 'mapa' ? 'inverse' : 'body'} className="text-sm font-medium">
              Mapa
            </Text>
          </Pressable>
        </View>

        {vistaTipo === 'mapa' && (
          <Pressable
            className="w-11 h-11 rounded-lg items-center justify-center bg-primary"
            onPress={obtenerUbicacionActual}
            disabled={obteniendoUbicacion}
          >
            {obteniendoUbicacion ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        )}

        {vistaTipo === 'lista' && (
          <Pressable
            className="w-11 h-11 rounded-lg items-center justify-center border border-border-subtle dark:border-border-subtle-dark"
            style={{ backgroundColor: colors.background }}
            onPress={() => setShowFiltros(!showFiltros)}
          >
            <Ionicons name="filter-outline" size={20} color={colors.text} />
          </Pressable>
        )}
      </Surface>

      {vistaTipo === 'lista' && showFiltros && (
        <Surface variant="solid" className="p-md border-b border-border-subtle dark:border-border-subtle-dark gap-md">
          <Input
            label="Buscar"
            value={filtroNombre}
            onChangeText={setFiltroNombre}
            placeholder="Nombre de cancha o complejo"
          />
          <Input
            label="Precio min"
            value={precioMin?.toString() || ''}
            onChangeText={(text) => setPrecioMin(text ? parseFloat(text) : undefined)}
            placeholder="0"
            keyboardType="numeric"
          />
          <Input
            label="Precio max"
            value={precioMax?.toString() || ''}
            onChangeText={(text) => setPrecioMax(text ? parseFloat(text) : undefined)}
            placeholder="999999"
            keyboardType="numeric"
          />
          <View className="gap-xs">
            <Text variant="label">Ordenar por</Text>
            <View className="flex-row gap-sm">
              {(['precio', 'distancia', 'nombre'] as const).map((opcion) => (
                <Chip
                  key={opcion}
                  active={ordenarPor === opcion}
                  label={opcion === 'precio' ? 'Precio' : opcion === 'distancia' ? 'Distancia' : 'Nombre'}
                  onPress={() => setOrdenarPor(opcion)}
                  className="flex-1 items-center"
                />
              ))}
            </View>
          </View>
        </Surface>
      )}

      {loading ? (
        <PlayerLoadingView message="Buscando canchas..." style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />
      ) : !fechaHora ? (
        <View className="flex-1 justify-center items-center p-xl">
          <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
          <Text variant="h4" className="mt-md mb-xs">
            Selecciona fecha y hora
          </Text>
          <Text variant="caption" className="text-center">
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
                dateToUtcIsoHN(fechaHora)
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
          ordenarPor={ordenarPor}
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
                obtenerCanchasDeComplejo(
                  complejo.id,
                  fechaHora ? dateToUtcIsoHN(fechaHora) : dateToUtcIsoHN(new Date())
                )
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

      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={showFechaHoraModal}
        onBackdropPress={() => setShowFechaHoraModal(false)}
        onBackButtonPress={() => setShowFechaHoraModal(false)}
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b border-border-subtle dark:border-border-subtle-dark">
              <Text variant="h3">Fecha y hora</Text>
              <TouchableOpacity onPress={() => setShowFechaHoraModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text variant="caption" className="uppercase tracking-wide font-semibold mb-sm mt-xs">
                Fecha
              </Text>
              <FechaHoraNativePickers
                part="date"
                draftDateTime={draftDateTime}
                setDraftDateTime={setDraftDateTime}
                pickerTheme={appTheme}
                weekdayLabelColor={colors.text}
                shellStyle={[PICKER_SHELL, { backgroundColor: colors.surface }]}
              />

              <Text variant="caption" className="uppercase tracking-wide font-semibold mb-sm mt-xs">
                Hora
              </Text>
              <FechaHoraNativePickers
                part="time"
                draftDateTime={draftDateTime}
                setDraftDateTime={setDraftDateTime}
                pickerTheme={appTheme}
                shellStyle={[PICKER_SHELL, PICKER_SHELL_TIME, { backgroundColor: colors.surface }]}
              />

              <View className="flex-row gap-sm mt-md pt-md border-t border-border-subtle dark:border-border-subtle-dark">
                <Button variant="outline" className="flex-1" onPress={() => setShowFechaHoraModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onPress={confirmFechaHora}>
                  Listo
                </Button>
              </View>
            </ScrollView>
        </DialogSheet>
      </RNModal>

      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={showModalDetalle}
        onBackdropPress={() => setShowModalDetalle(false)}
        onBackButtonPress={() => setShowModalDetalle(false)}
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b border-border-subtle dark:border-border-subtle-dark">
              <Text variant="h3">Detalles de Cancha</Text>
              <TouchableOpacity onPress={() => setShowModalDetalle(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {canchaSeleccionada && (
              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerClassName="p-lg"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {canchaSeleccionada.fotos && canchaSeleccionada.fotos.length > 0 && (
                  <ScrollView horizontal className="max-h-[200px]" showsHorizontalScrollIndicator={false}>
                    {canchaSeleccionada.fotos.map((foto) => (
                      <Image
                        key={foto.id}
                        source={{ uri: foto.foto_url }}
                        className="w-[300px] h-[200px] mr-sm"
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                )}

                <Text variant="label" className="mt-md mb-xs">Nombre</Text>
                <Text variant="body" className="mb-sm">{canchaSeleccionada.nombre}</Text>

                <Text variant="label" className="mb-xs">Complejo</Text>
                <Text variant="body" className="mb-sm">{canchaSeleccionada.complejo.nombre}</Text>

                {canchaSeleccionada.complejo.direccion_texto && (
                  <>
                    <Text variant="label" className="mb-xs">Dirección</Text>
                    <Text variant="body" className="mb-sm">{canchaSeleccionada.complejo.direccion_texto}</Text>
                  </>
                )}

                <View className="flex-row gap-md">
                  <View className="flex-1">
                    <Text variant="label" className="mb-xs">Precio</Text>
                    <Text variant="body" style={{ color: colors.success }}>
                      {formatCurrency(canchaSeleccionada.precio_por_hora)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text variant="label" className="mb-xs">Jugadores</Text>
                    <Text variant="body">{canchaSeleccionada.jugadores_por_equipo} por equipo</Text>
                  </View>
                </View>

                {canchaSeleccionada.distancia !== undefined && (
                  <>
                    <Text variant="label" className="mt-md mb-xs">Distancia</Text>
                    <Text variant="body" className="mb-sm">{canchaSeleccionada.distancia.toFixed(1)} km</Text>
                  </>
                )}

                <View
                  className="p-md rounded-lg mt-md items-center"
                  style={{
                    backgroundColor: canchaSeleccionada.disponible
                      ? colors.success + '20'
                      : colors.error + '20',
                  }}
                >
                  <Text
                    variant="body"
                    className="font-bold"
                    style={{ color: canchaSeleccionada.disponible ? colors.success : colors.error }}
                  >
                    {canchaSeleccionada.disponible ? '✓ Disponible' : '✗ No disponible'}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View className="flex-row p-lg border-t border-border-subtle dark:border-border-subtle-dark gap-md">
              <Button variant="outline" className="flex-1" onPress={() => setShowModalDetalle(false)}>
                Cerrar
              </Button>
              {canchaSeleccionada?.disponible && (
                <Button
                  className="flex-1"
                  onPress={() => canchaSeleccionada && handleReservar(canchaSeleccionada)}
                  disabled={reservando}
                  loading={reservando}
                >
                  <View className="flex-row items-center gap-xs">
                    {!reservando && <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
                    <Text variant="inverse">Reservar</Text>
                  </View>
                </Button>
              )}
            </View>
        </DialogSheet>
      </RNModal>

      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={showModalComplejo}
        onBackdropPress={() => setShowModalComplejo(false)}
        onBackButtonPress={() => setShowModalComplejo(false)}
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b border-border-subtle dark:border-border-subtle-dark">
              <View className="flex-1">
                <Text variant="h3">{complejoSeleccionado?.nombre}</Text>
                {complejoSeleccionado?.direccion_texto && (
                  <Text variant="caption" className="mt-1">{complejoSeleccionado.direccion_texto}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowModalComplejo(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {fotosComplejo.length > 0 && (
              <ScrollView horizontal className="max-h-[200px]" showsHorizontalScrollIndicator={false}>
                {fotosComplejo.map((foto) => (
                  <Image
                    key={foto.id}
                    source={{ uri: foto.foto_url }}
                    className="w-[300px] h-[200px] mr-sm"
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {loadingComplejo ? (
                <PlayerLoadingView
                  message="Cargando canchas..."
                  style={{ flex: 0, paddingVertical: Spacing.xl }}
                />
              ) : canchasComplejo.length === 0 ? (
                <PlayerEmptyState
                  variant="emptyField"
                  title="No hay canchas"
                  text="No hay canchas disponibles en este complejo para la fecha y hora seleccionadas."
                  compact
                />
              ) : (
                canchasComplejo.map((cancha) => (
                  <Pressable
                    key={cancha.id}
                    className={cn(
                      'rounded-lg mb-md border overflow-hidden',
                      cancha.disponible ? 'border-l-4' : '',
                      !cancha.disponible && 'opacity-60'
                    )}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: cancha.disponible ? colors.success + '40' : colors.borderSubtle,
                      borderLeftColor: cancha.disponible ? colors.success : undefined,
                    }}
                    onPress={() => {
                      setCanchaSeleccionada(cancha);
                      setShowModalComplejo(false);
                      setShowModalDetalle(true);
                    }}
                  >
                    {cancha.fotos && cancha.fotos.length > 0 && (
                      <Image
                        source={{ uri: cancha.fotos[0].foto_url }}
                        className="w-full h-[150px]"
                        style={{ backgroundColor: colors.borderSubtle }}
                        resizeMode="cover"
                      />
                    )}

                    <View className="p-md">
                      <View className="flex-row justify-between items-start mb-sm">
                        <Text variant="h4" className="flex-1 mr-sm">{cancha.nombre}</Text>
                        <View
                          className="px-sm py-1 rounded-sm"
                          style={{
                            backgroundColor: cancha.disponible
                              ? colors.success + '20'
                              : colors.error + '20',
                          }}
                        >
                          <Text
                            variant="caption"
                            className="font-semibold"
                            style={{ color: cancha.disponible ? colors.success : colors.error }}
                          >
                            {cancha.disponible ? 'Disponible' : 'No disponible'}
                          </Text>
                        </View>
                      </View>
                      <View className="gap-xs">
                        <View className="flex-row items-center gap-xs">
                          <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                          <Text variant="caption" className="font-medium">Precio:</Text>
                          <Text variant="caption" style={{ color: colors.success }}>
                            {formatCurrency(cancha.precio_por_hora)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-xs">
                          <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                          <Text variant="caption" className="font-medium">Jugadores:</Text>
                          <Text variant="caption">{cancha.jugadores_por_equipo} por equipo</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
        </DialogSheet>
      </RNModal>

      <PublicarPartidoModal
        visible={showPublicarModal}
        reservaIdPrefilled={reservaIdParaPublicar}
        onClose={() => {
          setShowPublicarModal(false);
          setReservaIdParaPublicar(undefined);
        }}
        onSuccess={(matchesFound) => {
          const extra =
            matchesFound > 0
              ? ` Encontramos ${matchesFound} rival${matchesFound !== 1 ? 'es' : ''} compatible${matchesFound !== 1 ? 's' : ''}.`
              : '';
          showSuccess(
            'Partido publicado',
            `Tu partido ya busca rival. Revisá solicitudes en Mis Potras.${extra}`,
            () => {
              router.push({
                pathname: '/(tabs)/mis-reservas',
                params: { seccion: 'solicitudes' },
              });
            }
          );
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
    </Screen>
  );
}

export default BuscarScreen;
