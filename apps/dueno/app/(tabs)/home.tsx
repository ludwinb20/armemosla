import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCanchas, CanchaWithRelations, CanchaDisponibilidad, getCanchaDisponibilidad } from '../../lib/canchas';
import { getReservas, createReserva, updateReserva, cancelarReserva, ReservaWithRelations } from '../../lib/reservas';
import {
  formatLocalDateYMD,
  formatHora12FromDate,
  formatHora12HN,
  localHNToUtcIso,
  getHourInHN,
} from '../../lib/fechaHora';
import { supabase } from '../../lib/supabase';
import ReservaCalendar from '../../components/ReservaCalendar';
import MonthlyCalendar from '../../components/MonthlyCalendar';
import { Screen, Text, Button, Card, Input, Chip, Divider, DialogSheet } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import {
  getRModalBackdropProps,
  getRModalBottomSheetStyle,
  getRModalCardLayout,
  getRModalCenterSheetStyle,
  rModalAnimCenter,
  rModalAnimSheet,
} from '../../lib/rnModalPresets';

export default function HomeScreen() {
  const { colors } = useGlassTheme();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const rBottom = getRModalBottomSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesActual, setMesActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  });
  const [canchaSeleccionada, setCanchaSeleccionada] = useState<string>(''); // '' = todas
  const [modalVisible, setModalVisible] = useState(false);
  const [modalReserva, setModalReserva] = useState<ReservaWithRelations | null>(null);
  const [formFecha, setFormFecha] = useState('');
  const [formHora, setFormHora] = useState('');
  const [formCanchaId, setFormCanchaId] = useState('');
  const [formMadeByPlayer, setFormMadeByPlayer] = useState(true);
  const [formEstado, setFormEstado] = useState<'pendiente' | 'completada' | 'cancelada'>('pendiente');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState({ hora: '12', minuto: '00', ampm: 'PM' as 'AM' | 'PM' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [disponibilidadCancha, setDisponibilidadCancha] = useState<CanchaDisponibilidad[]>([]);
  const [reservasCancha, setReservasCancha] = useState<ReservaWithRelations[]>([]);
  const [disponibilidadTodasCanchas, setDisponibilidadTodasCanchas] = useState<Record<string, CanchaDisponibilidad[]>>({});
  const [showCanchaSelector, setShowCanchaSelector] = useState(false);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      loadCanchas();
      loadReservas();
    }, [mesActual, canchaSeleccionada])
  );

  // Cargar disponibilidad y reservas cuando cambia la cancha seleccionada
  useEffect(() => {
    if (canchaSeleccionada) {
      loadDisponibilidadCancha(canchaSeleccionada);
      loadReservasCancha(canchaSeleccionada);
    } else {
      setDisponibilidadCancha([]);
      setReservasCancha([]);
      // Cargar disponibilidad de todas las canchas
      if (canchas.length > 0) {
        loadDisponibilidadTodasCanchas();
      }
    }
  }, [canchaSeleccionada, canchas.length]);

  // Cargar disponibilidad cuando se cargan las canchas y hay un día seleccionado
  useEffect(() => {
    if (canchas.length > 0 && diaSeleccionado) {
      if (canchaSeleccionada) {
        loadDisponibilidadCancha(canchaSeleccionada);
        loadReservasCancha(canchaSeleccionada);
      } else {
        loadDisponibilidadTodasCanchas();
      }
    }
  }, [canchas.length, diaSeleccionado]);

  // Actualizar hora cuando cambia la disponibilidad o la fecha
  useEffect(() => {
    if (formCanchaId && formFecha && disponibilidadCancha.length > 0) {
      const fecha = new Date(formFecha);
      const horasDisponibles = getHorasDisponibles(fecha);
      // Si la hora actual no está disponible, limpiarla
      if (formHora && horasDisponibles.length > 0) {
        const horaMatch = formHora.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (horaMatch) {
          const [, h, m, a] = horaMatch;
          let hour24 = parseInt(h, 10);
          if (a.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
          if (a.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
          const horaDisponible = horasDisponibles.some((hora) => hora.hora === hour24);
          if (!horaDisponible) {
            setFormHora('');
          }
        }
      } else if (horasDisponibles.length === 0) {
        setFormHora('');
      }
    }
  }, [formCanchaId, formFecha, disponibilidadCancha, reservasCancha]);

  const loadCanchas = async () => {
    try {
      const data = await getCanchas(undefined, true); // Solo canchas activas
      setCanchas(data);
    } catch (error: any) {
      console.error('Error al cargar canchas:', error);
      showError('Error', 'No se pudieron cargar las canchas');
    }
  };

  const loadReservas = async () => {
    try {
      setLoading(true);
      // Cargar reservas del mes actual
      const inicioMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
      inicioMes.setHours(0, 0, 0, 0);
      const finMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
      finMes.setHours(23, 59, 59, 999);
      
      const data = await getReservas(inicioMes.toISOString(), finMes.toISOString(), canchaSeleccionada || undefined);
      setReservas(data);
    } catch (error: any) {
      console.error('Error al cargar reservas:', error);
      showError('Error', 'No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
    }
  };

  const loadDisponibilidadCancha = async (canchaId: string) => {
    try {
      const disponibilidad = await getCanchaDisponibilidad(canchaId);
      setDisponibilidadCancha(disponibilidad);
    } catch (error: any) {
      console.error('Error al cargar disponibilidad:', error);
      setDisponibilidadCancha([]);
    }
  };

  const loadReservasCancha = async (canchaId: string) => {
    try {
      // Cargar reservas de las próximas 4 semanas
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date();
      fin.setDate(fin.getDate() + 28); // 4 semanas
      fin.setHours(23, 59, 59, 999);
      
      const reservas = await getReservas(inicio.toISOString(), fin.toISOString(), canchaId);
      // Solo reservas pendientes o completadas (no canceladas)
      const reservasActivas = reservas.filter((r) => r.estado !== 'cancelada');
      setReservasCancha(reservasActivas);
    } catch (error: any) {
      console.error('Error al cargar reservas de cancha:', error);
      setReservasCancha([]);
    }
  };

  // Cargar disponibilidad de todas las canchas
  const loadDisponibilidadTodasCanchas = async () => {
    try {
      const disponibilidadMap: Record<string, CanchaDisponibilidad[]> = {};
      await Promise.all(
        canchas.map(async (cancha) => {
          try {
            const disponibilidad = await getCanchaDisponibilidad(cancha.id);
            disponibilidadMap[cancha.id] = disponibilidad;
          } catch (error) {
            console.error(`Error al cargar disponibilidad de cancha ${cancha.id}:`, error);
            disponibilidadMap[cancha.id] = [];
          }
        })
      );
      setDisponibilidadTodasCanchas(disponibilidadMap);
    } catch (error: any) {
      console.error('Error al cargar disponibilidad de todas las canchas:', error);
    }
  };


  // Funciones de conversión de hora
  const convert24To12 = (time24: string): { hora: string; minuto: string; ampm: 'AM' | 'PM' } => {
    const parts = time24.split(':');
    const hour24 = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    
    let hour12: number;
    let ampm: 'AM' | 'PM';
    
    if (hour24 === 0) {
      hour12 = 12;
      ampm = 'AM';
    } else if (hour24 < 12) {
      hour12 = hour24;
      ampm = 'AM';
    } else if (hour24 === 12) {
      hour12 = 12;
      ampm = 'PM';
    } else {
      hour12 = hour24 - 12;
      ampm = 'PM';
    }
    
    return {
      hora: hour12.toString(),
      minuto: minute,
      ampm,
    };
  };

  const convert12To24 = (hora12: string, minuto: string, ampm: 'AM' | 'PM'): string => {
    let hour24 = parseInt(hora12, 10);
    
    if (ampm === 'AM') {
      if (hour24 === 12) {
        hour24 = 0;
      }
    } else {
      if (hour24 !== 12) {
        hour24 += 12;
      }
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minuto.padStart(2, '0')}:00`;
  };

  // Función para formatear hora en formato 12 horas consistente
  const formatHora12 = (fecha: Date): string => {
    const horas = fecha.getHours();
    const minutos = fecha.getMinutes();
    const ampm = horas >= 12 ? 'PM' : 'AM';
    const horas12 = horas % 12 || 12;
    return `${horas12.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')} ${ampm}`;
  };

  const openTimePicker = () => {
    if (formHora) {
      // Si ya hay una hora, convertirla a formato 12 horas
      const hora24 = formHora.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (hora24) {
        const [, h, m, a] = hora24;
        let hour24 = parseInt(h, 10);
        if (a.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
        if (a.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
        const time12 = convert24To12(`${hour24.toString().padStart(2, '0')}:${m}:00`);
        setTimePickerValue(time12);
      }
    } else {
      // Hora por defecto: 12:00 PM
      setTimePickerValue({ hora: '12', minuto: '00', ampm: 'PM' });
    }
    setShowTimePicker(true);
  };

  const saveTime = () => {
    const timeString = convert12To24(timePickerValue.hora, timePickerValue.minuto, timePickerValue.ampm);
    const [hour24, minute] = timeString.split(':');
    const hour12 = parseInt(hour24, 10) % 12 || 12;
    setFormHora(`${hour12.toString().padStart(2, '0')}:${minute} ${timePickerValue.ampm}`);
    setShowTimePicker(false);
  };

  // Obtener días de la semana disponibles según la disponibilidad de la cancha
  const getDiasDisponibles = (): number[] => {
    if (!formCanchaId || disponibilidadCancha.length === 0) {
      // Si no hay cancha seleccionada o no hay disponibilidad, todos los días están disponibles
      return [0, 1, 2, 3, 4, 5, 6]; // Lunes a Domingo
    }
    return disponibilidadCancha.map((d) => d.dia_semana);
  };

  // Obtener fechas disponibles (solo días permitidos en las próximas 4 semanas)
  const getFechasDisponibles = (): Date[] => {
    const diasDisponibles = getDiasDisponibles();
    const fechas: Date[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Generar fechas para las próximas 4 semanas
    for (let i = 0; i < 28; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      const diaSemana = (fecha.getDay() + 6) % 7; // Convertir a 0=Lunes, 6=Domingo
      
      if (diasDisponibles.includes(diaSemana)) {
        fechas.push(fecha);
      }
    }
    
    return fechas;
  };

  // Obtener horas disponibles según la disponibilidad de la cancha y reservas existentes
  const getHorasDisponibles = (fechaSeleccionada: Date): Array<{ hora: number; minuto: number }> => {
    if (!formCanchaId || disponibilidadCancha.length === 0) {
      // Si no hay cancha seleccionada o no hay disponibilidad, todas las horas están disponibles
      return Array.from({ length: 24 }, (_, i) => ({ hora: i, minuto: 0 }));
    }

    const diaSemana = (fechaSeleccionada.getDay() + 6) % 7; // Convertir a 0=Lunes, 6=Domingo
    const disponibilidadDia = disponibilidadCancha.find((d) => d.dia_semana === diaSemana);
    
    if (!disponibilidadDia) {
      return []; // No hay disponibilidad para este día
    }

    // Parsear horas de inicio y fin
    const [horaInicioStr, minutoInicioStr] = disponibilidadDia.hora_inicio.split(':');
    const [horaFinStr, minutoFinStr] = disponibilidadDia.hora_fin.split(':');
    const horaInicio = parseInt(horaInicioStr, 10);
    const minutoInicio = parseInt(minutoInicioStr, 10);
    const horaFin = parseInt(horaFinStr, 10);
    const minutoFin = parseInt(minutoFinStr, 10);

    // Generar todas las horas disponibles en intervalos de 1 hora
    const horas: Array<{ hora: number; minuto: number }> = [];
    let horaActual = horaInicio;
    let minutoActual = minutoInicio;

    while (horaActual < horaFin || (horaActual === horaFin && minutoActual < minutoFin)) {
      horas.push({ hora: horaActual, minuto: minutoActual });
      
      // Avanzar 1 hora
      horaActual += 1;
      if (horaActual >= 24) break;
    }

    // Filtrar horas que ya tienen reservas
    const fechaISO = formatLocalDateYMD(fechaSeleccionada);
    const horasOcupadas = reservasCancha
      .filter((r) => {
        const reservaFechaISO = formatLocalDateYMD(r.fecha_hora);
        return reservaFechaISO === fechaISO && r.estado !== 'cancelada';
      })
      .map((r) => getHourInHN(r.fecha_hora));

    return horas.filter((h) => !horasOcupadas.includes(h.hora));
  };

  // Obtener horas del día seleccionado para mostrar en las casillas
  const getHorasDelDia = (fecha: Date, canchaId?: string): Array<{ hora: number }> => {
    const canchaIdToUse = canchaId || canchaSeleccionada;
    if (!canchaIdToUse) {
      return [];
    }

    // Obtener disponibilidad de la cancha específica
    const disponibilidad = canchaIdToUse === canchaSeleccionada 
      ? disponibilidadCancha 
      : disponibilidadTodasCanchas[canchaIdToUse] || [];

    if (disponibilidad.length === 0) {
      return [];
    }

    const diaSemana = (fecha.getDay() + 6) % 7; // Convertir a 0=Lunes, 6=Domingo
    const disponibilidadDia = disponibilidad.find((d) => d.dia_semana === diaSemana);
    
    if (!disponibilidadDia) {
      return []; // No hay disponibilidad para este día
    }

    // Parsear horas de inicio y fin
    const [horaInicioStr] = disponibilidadDia.hora_inicio.split(':');
    const [horaFinStr] = disponibilidadDia.hora_fin.split(':');
    const horaInicio = parseInt(horaInicioStr, 10);
    const horaFin = parseInt(horaFinStr, 10);

    // Generar todas las horas disponibles en intervalos de 1 hora
    const horas: Array<{ hora: number }> = [];
    for (let hora = horaInicio; hora < horaFin; hora++) {
      horas.push({ hora });
    }

    return horas;
  };

  // Verificar si una hora está reservada
  const isHoraReservada = (fecha: Date, hora: number, canchaId?: string): boolean => {
    const fechaISO = formatLocalDateYMD(fecha);
    const reservasFiltradas = canchaId 
      ? reservas.filter((r) => r.cancha_id === canchaId)
      : filtrarReservasPorCancha(reservas);
    
    return reservasFiltradas.some((r) => {
      const reservaFechaISO = formatLocalDateYMD(r.fecha_hora);
      const reservaHora = getHourInHN(r.fecha_hora);
      return reservaFechaISO === fechaISO && reservaHora === hora && r.estado !== 'cancelada';
    });
  };

  // Obtener la reserva en una hora específica
  const getReservaEnHora = (fecha: Date, hora: number, canchaId?: string): ReservaWithRelations | null => {
    const fechaISO = formatLocalDateYMD(fecha);
    const reservasFiltradas = canchaId 
      ? reservas.filter((r) => r.cancha_id === canchaId)
      : filtrarReservasPorCancha(reservas);
    
    const reserva = reservasFiltradas.find((r) => {
      const reservaFechaISO = formatLocalDateYMD(r.fecha_hora);
      const reservaHora = getHourInHN(r.fecha_hora);
      return reservaFechaISO === fechaISO && reservaHora === hora && r.estado !== 'cancelada';
    });
    return reserva || null;
  };

  // Formatear hora para mostrar en la casilla
  const formatHoraSlot = (hora: number): string => {
    if (hora === 0) return '12 AM';
    if (hora < 12) return `${hora} AM`;
    if (hora === 12) return '12 PM';
    return `${hora - 12} PM`;
  };

  const openDatePicker = () => {
    if (formFecha) {
      setFechaSeleccionada(new Date(formFecha));
    } else {
      setFechaSeleccionada(new Date());
    }
    setShowDatePicker(true);
  };

  const saveDate = () => {
    setFormFecha(formatLocalDateYMD(fechaSeleccionada));
    // Limpiar la hora seleccionada si la nueva fecha no tiene horas disponibles
    const horasDisponibles = getHorasDisponibles(fechaSeleccionada);
    if (horasDisponibles.length === 0) {
      setFormHora('');
    }
    setShowDatePicker(false);
  };

  const handleReservaPress = (reserva: ReservaWithRelations) => {
    setModalReserva(reserva);
    setFormCanchaId(reserva.cancha_id);
    setFormFecha(formatLocalDateYMD(reserva.fecha_hora));
    setFormHora(formatHora12HN(reserva.fecha_hora));
    // No necesitamos establecer made_by_player ni estado ya que no se muestran en el modal
    setModalVisible(true);
  };

  const handleSlotPress = async (canchaId: string, fechaHora: Date) => {
    setModalReserva(null);
    setFormCanchaId(canchaId || '');
    setFormFecha(formatLocalDateYMD(fechaHora));
    setFormHora(formatHora12FromDate(fechaHora));
    // Las reservas creadas desde esta pantalla siempre son hechas por el administrador
    setFormMadeByPlayer(false);
    setFormEstado('pendiente');
    // Cargar disponibilidad y reservas de la cancha
    if (canchaId) {
      await loadDisponibilidadCancha(canchaId);
      await loadReservasCancha(canchaId);
    }
    setModalVisible(true);
  };

  const handleGuardarReserva = async () => {
    try {
      if (!formCanchaId || !formFecha || !formHora) {
        showError('Error', 'Por favor completa todos los campos obligatorios');
        return;
      }

      // Convertir hora de 12 horas a 24 horas
      const horaMatch = formHora.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!horaMatch) {
        showError('Error', 'Por favor selecciona una hora válida');
        return;
      }
      
      const [, horaStr, minutosStr, ampm] = horaMatch;
      const timeString = convert12To24(horaStr, minutosStr, ampm.toUpperCase() as 'AM' | 'PM');
      const [hour24, minute] = timeString.split(':');

      // Crear fecha/hora en hora local de Honduras
      const fechaHoraIso = localHNToUtcIso(
        formFecha,
        parseInt(hour24, 10),
        parseInt(minute, 10)
      );

      if (modalReserva) {
        // Actualizar reserva existente (solo fecha/hora y cancha, no estado ni made_by_player)
        await updateReserva(modalReserva.id, {
          cancha_id: formCanchaId,
          fecha_hora: fechaHoraIso,
        });
        showSuccess('Éxito', 'Reserva actualizada correctamente');
      } else {
        // Crear nueva reserva (siempre made_by_player = false para reservas del administrador)
        await createReserva({
          cancha_id: formCanchaId,
          fecha_hora: fechaHoraIso,
          made_by_player: false,
          user_id: undefined,
        });
        showSuccess('Éxito', 'Reserva creada correctamente');
      }

      setModalVisible(false);
      loadReservas();
    } catch (error: any) {
      console.error('Error al guardar reserva:', error);
      showError('Error', error.message || 'No se pudo guardar la reserva');
    }
  };

  const handleCancelarReserva = async () => {
    if (!modalReserva) return;

    try {
      await cancelarReserva(modalReserva.id);
      showSuccess('Éxito', 'Reserva cancelada correctamente');
      setModalVisible(false);
      loadReservas();
    } catch (error: any) {
      console.error('Error al cancelar reserva:', error);
      showError('Error', error.message || 'No se pudo cancelar la reserva');
    }
  };

  const filtrarReservasPorCancha = (reservas: ReservaWithRelations[]): ReservaWithRelations[] => {
    if (!canchaSeleccionada) return reservas;
    return reservas.filter((r) => r.cancha_id === canchaSeleccionada);
  };

  return (
    <Screen className="flex-1" edges={['top', 'bottom']}>
      {/* Selector de cancha */}
      <View className="border-b p-md" style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <TouchableOpacity
          className="flex-row items-center justify-between px-md py-md rounded-md border" style={{ backgroundColor: colors.background, borderColor: colors.border }}
          onPress={() => setShowCanchaSelector(true)}
        >
          <Text className="text-md font-medium" style={{ color: colors.text }}>
            {canchaSeleccionada 
              ? canchas.find((c) => c.id === canchaSeleccionada)?.nombre || 'Seleccionar cancha'
              : 'Todas las canchas'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Modal selector de cancha */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimSheet}
        isVisible={showCanchaSelector}
        onBackdropPress={() => setShowCanchaSelector(false)}
        onBackButtonPress={() => setShowCanchaSelector(false)}
        style={rBottom}
      >
        <View className="flex-1 justify-end">
          <SafeAreaView
            edges={['bottom']}
            className="rounded-t-xl overflow-hidden"
            style={{ backgroundColor: colors.background, maxHeight: '70%' }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <TouchableOpacity
                className="flex-row justify-between items-center p-md border-b"
                style={{
                  backgroundColor: !canchaSeleccionada ? colors.primary + '20' : colors.background,
                  borderColor: colors.border,
                  ...(!canchaSeleccionada ? { borderColor: colors.primary, borderWidth: 2 } : {}),
                }}
                onPress={() => {
                  setCanchaSeleccionada('');
                  setShowCanchaSelector(false);
                }}
              >
                <Text className="text-md font-medium" style={{ color: !canchaSeleccionada ? colors.primary : colors.text }}>
                  Todas las canchas
                </Text>
                {!canchaSeleccionada && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
              {canchas.map((cancha) => (
                <TouchableOpacity
                  key={cancha.id}
                  className="flex-row justify-between items-center p-md border-b"
                  style={{
                    backgroundColor: canchaSeleccionada === cancha.id ? colors.primary + '20' : colors.background,
                    borderColor: colors.border,
                    ...(canchaSeleccionada === cancha.id ? { borderColor: colors.primary, borderWidth: 2 } : {}),
                  }}
                  onPress={() => {
                    setCanchaSeleccionada(cancha.id);
                    setShowCanchaSelector(false);
                  }}
                >
                  <Text className="text-md font-medium" style={{ color: canchaSeleccionada === cancha.id ? colors.primary : colors.text }}>
                    {cancha.nombre}
                  </Text>
                  {canchaSeleccionada === cancha.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </RNModal>

      {/* Calendario mensual */}
      {loading ? (
        <PlayerLoadingView />
      ) : (
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          <MonthlyCalendar
            reservas={filtrarReservasPorCancha(reservas)}
            mesActual={mesActual}
            diaSeleccionado={diaSeleccionado}
            onMesAnterior={() => {
              const nuevoMes = new Date(mesActual);
              nuevoMes.setMonth(nuevoMes.getMonth() - 1);
              setMesActual(nuevoMes);
            }}
            onMesSiguiente={() => {
              const nuevoMes = new Date(mesActual);
              nuevoMes.setMonth(nuevoMes.getMonth() + 1);
              setMesActual(nuevoMes);
            }}
            onDiaPress={(fecha) => {
              setDiaSeleccionado(fecha);
              // Cargar disponibilidad y reservas si hay cancha seleccionada
              if (canchaSeleccionada) {
                loadDisponibilidadCancha(canchaSeleccionada);
                loadReservasCancha(canchaSeleccionada);
              }
            }}
          />

          {/* Casillas horarias del día seleccionado */}
          {diaSeleccionado && (
            <>
              {canchaSeleccionada ? (
                // Vista de una cancha específica
                <View className="p-md mt-sm rounded-md mx-md mb-md" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-md font-semibold mb-sm" style={{ color: colors.text }}>
                    {diaSeleccionado.toLocaleDateString('es-HN', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {getHorasDelDia(diaSeleccionado).map((horaInfo) => {
                      const isReservada = isHoraReservada(diaSeleccionado, horaInfo.hora);
                      return (
                        <TouchableOpacity
                          key={horaInfo.hora}
                          className="min-w-[60px] h-[60px] rounded-md border justify-center items-center mr-sm" style={{
                              backgroundColor: isReservada ? colors.primary : colors.borderLight,
                              borderColor: colors.border,
                            }}
                          onPress={() => {
                            if (isReservada) {
                              // Buscar la reserva y mostrar detalle
                              const reserva = getReservaEnHora(diaSeleccionado, horaInfo.hora);
                              if (reserva) {
                                handleReservaPress(reserva);
                              }
                            } else {
                              // Crear nueva reserva
                              const fechaHora = new Date(diaSeleccionado);
                              fechaHora.setHours(horaInfo.hora, 0, 0, 0);
                              handleSlotPress(canchaSeleccionada, fechaHora);
                            }
                          }}
                        >
                          <Text className="text-sm font-medium" style={{ color: isReservada ? colors.textInverse : colors.text }}>
                            {formatHoraSlot(horaInfo.hora)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                // Vista de todas las canchas
                <View className="p-md mt-sm mx-md mb-md">
                  <Text className="text-md font-semibold mb-sm" style={{ color: colors.text }}>
                    {diaSeleccionado.toLocaleDateString('es-HN', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </Text>
                  {canchas.map((cancha) => {
                    const horasDelDia = getHorasDelDia(diaSeleccionado, cancha.id);
                    
                    return (
                      <View key={cancha.id} className="p-md rounded-md border mb-md" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <Text className="text-md font-semibold mb-sm" style={{ color: colors.text }}>{cancha.nombre}</Text>
                        {horasDelDia.length === 0 ? (
                          <View className="p-md rounded-md items-center mt-xs" style={{ backgroundColor: colors.background }}>
                            <Text className="text-sm italic" style={{ color: colors.textSecondary }}>
                              No disponible para este día
                            </Text>
                          </View>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {horasDelDia.map((horaInfo) => {
                              const isReservada = isHoraReservada(diaSeleccionado, horaInfo.hora, cancha.id);
                              return (
                                <TouchableOpacity
                                  key={horaInfo.hora}
                                  className="min-w-[60px] h-[60px] rounded-md border justify-center items-center mr-sm" style={{
                                      backgroundColor: isReservada ? colors.primary : colors.borderLight,
                                      borderColor: colors.border,
                                    }}
                                  onPress={() => {
                                    if (isReservada) {
                                      // Buscar la reserva y mostrar detalle
                                      const reserva = getReservaEnHora(diaSeleccionado, horaInfo.hora, cancha.id);
                                      if (reserva) {
                                        handleReservaPress(reserva);
                                      }
                                    } else {
                                      // Crear nueva reserva
                                      const fechaHora = new Date(diaSeleccionado);
                                      fechaHora.setHours(horaInfo.hora, 0, 0, 0);
                                      handleSlotPress(cancha.id, fechaHora);
                                    }
                                  }}
                                >
                                  <Text className="text-sm font-medium" style={{ color: isReservada ? colors.textInverse : colors.text }}>
                                    {formatHoraSlot(horaInfo.hora)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Modal de crear/editar reserva - Copiado desde reservas.tsx */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        avoidKeyboard
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b flex-shrink-0" style={{ borderBottomColor: colors.border }}>
              <Text className="text-xl font-bold" style={{ color: colors.text }}>
                {modalReserva 
                  ? modalReserva.estado === 'pendiente' 
                    ? 'Editar Reserva' 
                    : 'Detalle de Reserva'
                  : 'Nueva Reserva'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {/* Estado (solo mostrar si está cancelada o completada) */}
              {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') && (
                <View className="mb-lg">
                  <Text className="text-md font-semibold mb-sm">Estado</Text>
                  <View className="p-md rounded-md border" style={{
                    backgroundColor: modalReserva.estado === 'cancelada' 
                      ? colors.error + '20' 
                      : colors.success + '20',
                  }}>
                    <Text className="text-md" style={{
                      color: modalReserva.estado === 'cancelada' 
                        ? colors.error 
                        : colors.success,
                    }}>
                      {modalReserva.estado === 'cancelada' ? 'Cancelada' : 'Completada'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Cancha */}
              <View className="mb-lg">
                <Text className="text-md font-semibold mb-sm">Cancha *</Text>
                {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') ? (
                  <View className="p-md rounded-md border">
                    <Text className="text-md">
                      {canchas.find((c) => c.id === formCanchaId)?.nombre || 'Cancha'}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-sm">
                    {canchas.map((cancha) => (
                      <TouchableOpacity
                        key={cancha.id}
                        className={cn("flex-row items-center px-md py-sm rounded-md border mr-sm mb-sm", formCanchaId === cancha.id && "bg-primary border-primary")}
                        onPress={async () => {
                          setFormCanchaId(cancha.id);
                          // Cargar disponibilidad y reservas de la cancha seleccionada
                          await loadDisponibilidadCancha(cancha.id);
                          await loadReservasCancha(cancha.id);
                        }}
                      >
                        <Text
                          className={cn("text-sm font-medium", formCanchaId === cancha.id && "text-text-inverse font-semibold")}
                        >
                          {cancha.nombre || `Cancha ${cancha.id.slice(0, 8)}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Fecha */}
              <View className="mb-lg">
                <Text className="text-md font-semibold mb-sm">Fecha *</Text>
                {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') ? (
                  <View className="p-md rounded-md border">
                    <Text className="text-md">
                      {formFecha 
                        ? new Date(formFecha).toLocaleDateString('es-HN', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : '-'}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="flex-row items-center justify-between border rounded-md p-md"
                    onPress={openDatePicker}
                  >
                    <Text className={cn("text-md font-medium", !formFecha && "text-text-secondary")}>
                      {formFecha 
                        ? new Date(formFecha).toLocaleDateString('es-HN', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'Seleccionar fecha'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Hora */}
              <View className="mb-lg">
                <Text className="text-md font-semibold mb-sm">Hora *</Text>
                {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') ? (
                  <View className="p-md rounded-md border">
                    <Text className="text-md">
                      {formHora || '-'}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="flex-row items-center justify-between border rounded-md p-md"
                    onPress={openTimePicker}
                  >
                    <Text className={cn("text-md font-medium", !formHora && "text-text-secondary")}>
                      {formHora || 'Seleccionar hora'}
                    </Text>
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Botones */}
              <View className="mt-lg gap-md">
                {modalReserva && modalReserva.estado === 'pendiente' && (
                  <TouchableOpacity
                    className="p-md rounded-md items-center bg-error"
                    onPress={handleCancelarReserva}
                  >
                    <Text className="text-md font-semibold text-text-inverse">Cancelar Reserva</Text>
                  </TouchableOpacity>
                )}
                {(!modalReserva || modalReserva.estado === 'pendiente') && (
                  <TouchableOpacity
                    className="p-md rounded-md items-center bg-primary"
                    onPress={handleGuardarReserva}
                  >
                    <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
        </DialogSheet>
      </RNModal>

      {/* Modal de TimePicker - Copiado desde reservas.tsx */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimSheet}
        isVisible={showTimePicker}
        onBackdropPress={() => setShowTimePicker(false)}
        onBackButtonPress={() => setShowTimePicker(false)}
        style={rBottom}
      >
        <Screen className="w-full" edges={['bottom']}>
          <View className="rounded-t-lg p-md max-h-[70%]" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-center mb-md pb-sm border-b" style={{ borderBottomColor: colors.border }}>
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Seleccionar Hora</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-md mb-md">
              <View className="flex-1 items-start">
                <Text className="text-sm font-medium mb-sm">Hora:</Text>
                <ScrollView
                  className="max-h-[200px]"
                  showsVerticalScrollIndicator={false}
                >
                  {(() => {
                    // Obtener horas disponibles según la fecha seleccionada
                    const fechaParaHoras = formFecha ? new Date(formFecha) : new Date();
                    const horasDisponibles = getHorasDisponibles(fechaParaHoras);
                    
                    // Convertir a formato 12 horas y agrupar por AM/PM
                    const horas12 = horasDisponibles.map((h) => {
                      const hora12 = h.hora % 12 || 12;
                      const ampm = h.hora < 12 ? 'AM' : 'PM';
                      return { hora: hora12, minuto: h.minuto, ampm, hora24: h.hora };
                    });

                    // Agrupar por hora (sin considerar minutos por ahora)
                    const horasUnicas = Array.from(
                      new Set(horas12.map((h) => `${h.hora}-${h.ampm}`))
                    ).map((key) => {
                      const [hora, ampm] = key.split('-');
                      return { hora: parseInt(hora, 10), ampm: ampm as 'AM' | 'PM' };
                    });

                    return horasUnicas.map((h) => (
                      <TouchableOpacity
                        key={`${h.hora}-${h.ampm}`}
                        className={cn("p-sm rounded-md mb-xs items-center", timePickerValue.hora === h.hora.toString() &&
                          timePickerValue.ampm === h.ampm && "border")}
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            hora: h.hora.toString(),
                            ampm: h.ampm,
                          })
                        }
                      >
                        <Text
                          className={cn("text-lg", timePickerValue.hora === h.hora.toString() &&
                            timePickerValue.ampm === h.ampm && "font-bold")}
                        >
                          {h.hora}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              </View>
              <View className="flex-1 items-start">
                <Text className="text-sm font-medium mb-sm">Minuto:</Text>
                <ScrollView
                  className="max-h-[200px]"
                  showsVerticalScrollIndicator={false}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <TouchableOpacity
                      key={m}
                      className={cn("p-sm rounded-md mb-xs items-center", timePickerValue.minuto === m.toString().padStart(2, '0') && "border")}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          minuto: m.toString().padStart(2, '0'),
                        })
                      }
                    >
                      <Text
                        className={cn("text-lg", timePickerValue.minuto === m.toString().padStart(2, '0') && "font-bold")}
                      >
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View className="flex-1 items-start">
                <Text className="text-sm font-medium mb-sm">Periodo:</Text>
                <View className="flex-col gap-xs mt-sm w-full">
                  <TouchableOpacity
                    className={cn("w-full p-sm rounded-md border items-center justify-center min-h-[40px]", timePickerValue.ampm === 'AM' && "bg-primary border-primary")}
                    onPress={() =>
                      setTimePickerValue({
                        ...timePickerValue,
                        ampm: 'AM',
                      })
                    }
                  >
                    <Text
                      className={cn("text-md font-medium", timePickerValue.ampm === 'AM' && "text-text-inverse font-bold")}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={cn("w-full p-sm rounded-md border items-center justify-center min-h-[40px]", timePickerValue.ampm === 'PM' && "bg-primary border-primary")}
                    onPress={() =>
                      setTimePickerValue({
                        ...timePickerValue,
                        ampm: 'PM',
                      })
                    }
                  >
                    <Text
                      className={cn("text-md font-medium", timePickerValue.ampm === 'PM' && "text-text-inverse font-bold")}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View className="flex-row gap-sm">
              <TouchableOpacity
                className="flex-1 p-md rounded-md items-center"
                onPress={() => setShowTimePicker(false)}
              >
                <Text className="text-md font-semibold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-md rounded-md items-center"
                onPress={saveTime}
              >
                <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Screen>
      </RNModal>

      {/* Modal de DatePicker - Copiado desde reservas.tsx */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimSheet}
        isVisible={showDatePicker}
        onBackdropPress={() => setShowDatePicker(false)}
        onBackButtonPress={() => setShowDatePicker(false)}
        style={rBottom}
      >
        <Screen className="w-full" edges={['bottom']}>
          <View className="rounded-t-lg p-md max-h-[70%]" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-center mb-md pb-sm border-b" style={{ borderBottomColor: colors.border }}>
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Seleccionar Fecha</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View className="mb-md">
              <ScrollView className="max-h-[300px]">
                <View className="flex-row flex-wrap gap-sm justify-start">
                  {getFechasDisponibles().map((fecha) => {
                    const fechaStr = formatLocalDateYMD(fecha);
                    const fechaFormStr = formFecha || '';
                    const isSelected = fechaStr === fechaFormStr;
                    
                    return (
                      <TouchableOpacity
                        key={fechaStr}
                        className={cn("w-[30%] min-w-[100px] p-md justify-center items-center rounded-md border", isSelected && "bg-primary border-primary")}
                        onPress={() => {
                          setFechaSeleccionada(fecha);
                        }}
                      >
                        <Text
                          className={cn("text-sm", isSelected && "text-text-inverse font-bold")}
                        >
                          {fecha.getDate()}
                        </Text>
                        <Text className="text-xs text-text-secondary mt-0.5">
                          {fecha.toLocaleDateString('es-HN', { weekday: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            <View className="flex-row gap-sm">
              <TouchableOpacity
                className="flex-1 p-md rounded-md items-center"
                onPress={() => setShowDatePicker(false)}
              >
                <Text className="text-md font-semibold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-md rounded-md items-center"
                onPress={saveDate}
              >
                <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Screen>
      </RNModal>

      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        type={alertOptions.type}
        onConfirm={handleConfirm}
        onCancel={alertOptions.onCancel ? handleCancel : undefined}
        cancelText={alertOptions.cancelText}
      />
    </Screen>
  );
}

