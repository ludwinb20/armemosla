import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { getCanchas, CanchaWithRelations, CanchaDisponibilidad, getCanchaDisponibilidad } from '../../lib/canchas';
import { getReservas, createReserva, updateReserva, cancelarReserva, ReservaWithRelations } from '../../lib/reservas';
import { supabase } from '../../lib/supabase';
import ReservaCalendar from '../../components/ReservaCalendar';
import MonthlyCalendar from '../../components/MonthlyCalendar';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  getRModalBackdropProps,
  getRModalBottomSheetStyle,
  getRModalCardLayout,
  getRModalCenterSheetStyle,
  rModalAnimLeft,
  rModalAnimSheet,
} from '../../lib/rnModalPresets';

export default function HomeScreen() {
  const colors = useThemeColors();
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
    const fechaISO = fechaSeleccionada.toISOString().split('T')[0];
    const horasOcupadas = reservasCancha
      .filter((r) => {
        const reservaFecha = new Date(r.fecha_hora);
        const reservaFechaISO = reservaFecha.toISOString().split('T')[0];
        return reservaFechaISO === fechaISO && r.estado !== 'cancelada';
      })
      .map((r) => {
        const reservaFecha = new Date(r.fecha_hora);
        return reservaFecha.getHours();
      });

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
    const fechaISO = fecha.toISOString().split('T')[0];
    const reservasFiltradas = canchaId 
      ? reservas.filter((r) => r.cancha_id === canchaId)
      : filtrarReservasPorCancha(reservas);
    
    return reservasFiltradas.some((r) => {
      const reservaFecha = new Date(r.fecha_hora);
      const reservaFechaISO = reservaFecha.toISOString().split('T')[0];
      const reservaHora = reservaFecha.getHours();
      return reservaFechaISO === fechaISO && reservaHora === hora && r.estado !== 'cancelada';
    });
  };

  // Obtener la reserva en una hora específica
  const getReservaEnHora = (fecha: Date, hora: number, canchaId?: string): ReservaWithRelations | null => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const reservasFiltradas = canchaId 
      ? reservas.filter((r) => r.cancha_id === canchaId)
      : filtrarReservasPorCancha(reservas);
    
    const reserva = reservasFiltradas.find((r) => {
      const reservaFecha = new Date(r.fecha_hora);
      const reservaFechaISO = reservaFecha.toISOString().split('T')[0];
      const reservaHora = reservaFecha.getHours();
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
    setFormFecha(fechaSeleccionada.toISOString().split('T')[0]);
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
    setFormFecha(new Date(reserva.fecha_hora).toISOString().split('T')[0]);
    setFormHora(formatHora12(new Date(reserva.fecha_hora)));
    // No necesitamos establecer made_by_player ni estado ya que no se muestran en el modal
    setModalVisible(true);
  };

  const handleSlotPress = async (canchaId: string, fechaHora: Date) => {
    setModalReserva(null);
    setFormCanchaId(canchaId || '');
    setFormFecha(fechaHora.toISOString().split('T')[0]);
    setFormHora(formatHora12(fechaHora));
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
      const fechaHora = new Date(`${formFecha}T${hour24}:${minute}:00`);
      
      if (modalReserva) {
        // Actualizar reserva existente (solo fecha/hora y cancha, no estado ni made_by_player)
        await updateReserva(modalReserva.id, {
          cancha_id: formCanchaId,
          fecha_hora: fechaHora.toISOString(),
        });
        showSuccess('Éxito', 'Reserva actualizada correctamente');
      } else {
        // Crear nueva reserva (siempre made_by_player = false para reservas del administrador)
        await createReserva({
          cancha_id: formCanchaId,
          fecha_hora: fechaHora.toISOString(),
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header con Bienvenido y Campanita */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Bienvenido</Text>
          <Text style={[styles.userName, { color: colors.text }]}>Administrador</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Selector de cancha */}
      <View style={[styles.canchasContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.canchaSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={() => setShowCanchaSelector(true)}
        >
          <Text style={[styles.canchaSelectorText, { color: colors.text }]}>
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
        <SafeAreaView edges={['bottom']} style={styles.modalBottomSheetWidth}>
          <View style={[styles.modalSelectorContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalSelectorHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalSelectorTitle, { color: colors.text }]}>Seleccionar Cancha</Text>
              <TouchableOpacity onPress={() => setShowCanchaSelector(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalSelectorList} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[
                  styles.modalSelectorOption,
                  { backgroundColor: !canchaSeleccionada ? Colors.primary + '20' : colors.background, borderColor: colors.border },
                  !canchaSeleccionada && { borderColor: Colors.primary, borderWidth: 2 },
                ]}
                onPress={() => {
                  setCanchaSeleccionada('');
                  setShowCanchaSelector(false);
                }}
              >
                <Text style={[styles.modalSelectorOptionText, { color: !canchaSeleccionada ? Colors.primary : colors.text }]}>
                  Todas las canchas
                </Text>
                {!canchaSeleccionada && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
              </TouchableOpacity>
              {canchas.map((cancha) => (
                <TouchableOpacity
                  key={cancha.id}
                  style={[
                    styles.modalSelectorOption,
                    { backgroundColor: canchaSeleccionada === cancha.id ? Colors.primary + '20' : colors.background, borderColor: colors.border },
                    canchaSeleccionada === cancha.id && { borderColor: Colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => {
                    setCanchaSeleccionada(cancha.id);
                    setShowCanchaSelector(false);
                  }}
                >
                  <Text style={[styles.modalSelectorOptionText, { color: canchaSeleccionada === cancha.id ? Colors.primary : colors.text }]}>
                    {cancha.nombre}
                  </Text>
                  {canchaSeleccionada === cancha.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Calendario mensual */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
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
                <View style={[styles.horasContainer, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.horasTitle, { color: colors.text }]}>
                    {diaSeleccionado.toLocaleDateString('es-HN', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horasScroll}>
                    {getHorasDelDia(diaSeleccionado).map((horaInfo) => {
                      const isReservada = isHoraReservada(diaSeleccionado, horaInfo.hora);
                      return (
                        <TouchableOpacity
                          key={horaInfo.hora}
                          style={[
                            styles.horaSlot,
                            {
                              backgroundColor: isReservada ? Colors.primary : colors.borderLight,
                              borderColor: colors.border,
                            }
                          ]}
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
                          <Text style={[styles.horaSlotText, { color: isReservada ? Colors.textInverse : colors.text }]}>
                            {formatHoraSlot(horaInfo.hora)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                // Vista de todas las canchas
                <View style={styles.todasCanchasContainer}>
                  <Text style={[styles.horasTitle, { color: colors.text }]}>
                    {diaSeleccionado.toLocaleDateString('es-HN', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </Text>
                  {canchas.map((cancha) => {
                    const horasDelDia = getHorasDelDia(diaSeleccionado, cancha.id);
                    
                    return (
                      <View key={cancha.id} style={[styles.canchaRowContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.canchaRowTitle, { color: colors.text }]}>{cancha.nombre}</Text>
                        {horasDelDia.length === 0 ? (
                          <View style={[styles.noDisponibleContainer, { backgroundColor: colors.background }]}>
                            <Text style={[styles.noDisponibleText, { color: colors.textSecondary }]}>
                              No disponible para este día
                            </Text>
                          </View>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horasScroll}>
                            {horasDelDia.map((horaInfo) => {
                              const isReservada = isHoraReservada(diaSeleccionado, horaInfo.hora, cancha.id);
                              return (
                                <TouchableOpacity
                                  key={horaInfo.hora}
                                  style={[
                                    styles.horaSlot,
                                    {
                                      backgroundColor: isReservada ? Colors.primary : colors.borderLight,
                                      borderColor: colors.border,
                                    }
                                  ]}
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
                                  <Text style={[styles.horaSlotText, { color: isReservada ? Colors.textInverse : colors.text }]}>
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
        {...rModalAnimLeft}
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuterWrap} edges={['top', 'bottom']}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
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
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {/* Estado (solo mostrar si está cancelada o completada) */}
              {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Estado</Text>
                  <View style={[styles.infoBox, {
                    backgroundColor: modalReserva.estado === 'cancelada' 
                      ? Colors.error + '20' 
                      : Colors.secondary + '20',
                  }]}>
                    <Text style={[styles.infoBoxText, {
                      color: modalReserva.estado === 'cancelada' 
                        ? Colors.error 
                        : Colors.secondary,
                    }]}>
                      {modalReserva.estado === 'cancelada' ? 'Cancelada' : 'Completada'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Cancha */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Cancha *</Text>
                {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') ? (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxText}>
                      {canchas.find((c) => c.id === formCanchaId)?.nombre || 'Cancha'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.selectContainer}>
                    {canchas.map((cancha) => (
                      <TouchableOpacity
                        key={cancha.id}
                        style={[
                          styles.selectOption,
                          formCanchaId === cancha.id && styles.selectOptionSelected,
                        ]}
                        onPress={async () => {
                          setFormCanchaId(cancha.id);
                          // Cargar disponibilidad y reservas de la cancha seleccionada
                          await loadDisponibilidadCancha(cancha.id);
                          await loadReservasCancha(cancha.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            formCanchaId === cancha.id && styles.selectOptionTextSelected,
                          ]}
                        >
                          {cancha.nombre || `Cancha ${cancha.id.slice(0, 8)}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Fecha */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha *</Text>
                {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') ? (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxText}>
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
                    style={styles.pickerButton}
                    onPress={openDatePicker}
                  >
                    <Text style={[styles.pickerButtonText, !formFecha && styles.pickerButtonTextPlaceholder]}>
                      {formFecha 
                        ? new Date(formFecha).toLocaleDateString('es-HN', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'Seleccionar fecha'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Hora */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hora *</Text>
                {modalReserva && (modalReserva.estado === 'cancelada' || modalReserva.estado === 'completada') ? (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxText}>
                      {formHora || '-'}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={openTimePicker}
                  >
                    <Text style={[styles.pickerButtonText, !formHora && styles.pickerButtonTextPlaceholder]}>
                      {formHora || 'Seleccionar hora'}
                    </Text>
                    <Ionicons name="time-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Botones */}
              <View style={styles.modalButtons}>
                {modalReserva && modalReserva.estado === 'pendiente' && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonDanger]}
                    onPress={handleCancelarReserva}
                  >
                    <Text style={styles.modalButtonTextDanger}>Cancelar Reserva</Text>
                  </TouchableOpacity>
                )}
                {(!modalReserva || modalReserva.estado === 'pendiente') && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleGuardarReserva}
                  >
                    <Text style={styles.modalButtonTextPrimary}>Guardar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
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
        <SafeAreaView style={styles.modalBottomSheetWidth} edges={['bottom']}>
          <View style={[styles.timePickerContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.timePickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.timePickerTitle, { color: colors.text }]}>Seleccionar Hora</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.timePickerContent}>
              <View style={styles.timePickerRow}>
                <Text style={styles.timePickerLabel}>Hora:</Text>
                <ScrollView
                  style={styles.timePickerScroll}
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
                        style={[
                          styles.timePickerOption,
                          timePickerValue.hora === h.hora.toString() &&
                          timePickerValue.ampm === h.ampm &&
                          styles.timePickerOptionSelected,
                        ]}
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            hora: h.hora.toString(),
                            ampm: h.ampm,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.timePickerOptionText,
                            timePickerValue.hora === h.hora.toString() &&
                            timePickerValue.ampm === h.ampm &&
                            styles.timePickerOptionTextSelected,
                          ]}
                        >
                          {h.hora}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              </View>
              <View style={styles.timePickerRow}>
                <Text style={styles.timePickerLabel}>Minuto:</Text>
                <ScrollView
                  style={styles.timePickerScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.timePickerOption,
                        timePickerValue.minuto === m.toString().padStart(2, '0') &&
                          styles.timePickerOptionSelected,
                      ]}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          minuto: m.toString().padStart(2, '0'),
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.timePickerOptionText,
                          timePickerValue.minuto === m.toString().padStart(2, '0') &&
                            styles.timePickerOptionTextSelected,
                        ]}
                      >
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.timePickerRow}>
                <Text style={styles.timePickerLabel}>Periodo:</Text>
                <View style={styles.ampmContainer}>
                  <TouchableOpacity
                    style={[
                      styles.ampmButton,
                      timePickerValue.ampm === 'AM' && styles.ampmButtonSelected,
                    ]}
                    onPress={() =>
                      setTimePickerValue({
                        ...timePickerValue,
                        ampm: 'AM',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.ampmButtonText,
                        timePickerValue.ampm === 'AM' && styles.ampmButtonTextSelected,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.ampmButton,
                      timePickerValue.ampm === 'PM' && styles.ampmButtonSelected,
                    ]}
                    onPress={() =>
                      setTimePickerValue({
                        ...timePickerValue,
                        ampm: 'PM',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.ampmButtonText,
                        timePickerValue.ampm === 'PM' && styles.ampmButtonTextSelected,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.timePickerActions}>
              <TouchableOpacity
                style={styles.timePickerCancelButton}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.timePickerCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timePickerSaveButton}
                onPress={saveTime}
              >
                <Text style={styles.timePickerSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
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
        <SafeAreaView style={styles.modalBottomSheetWidth} edges={['bottom']}>
          <View style={[styles.datePickerContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.datePickerTitle, { color: colors.text }]}>Seleccionar Fecha</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              <ScrollView style={styles.datePickerScroll}>
                <View style={styles.datePickerCalendar}>
                  {getFechasDisponibles().map((fecha) => {
                    const fechaStr = fecha.toISOString().split('T')[0];
                    const fechaFormStr = formFecha ? new Date(formFecha).toISOString().split('T')[0] : '';
                    const isSelected = fechaStr === fechaFormStr;
                    
                    return (
                      <TouchableOpacity
                        key={fechaStr}
                        style={[
                          styles.datePickerDay,
                          isSelected && styles.datePickerDaySelected,
                        ]}
                        onPress={() => {
                          setFechaSeleccionada(fecha);
                        }}
                      >
                        <Text
                          style={[
                            styles.datePickerDayText,
                            isSelected && styles.datePickerDayTextSelected,
                          ]}
                        >
                          {fecha.getDate()}
                        </Text>
                        <Text style={styles.datePickerDayName}>
                          {fecha.toLocaleDateString('es-HN', { weekday: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            <View style={styles.datePickerActions}>
              <TouchableOpacity
                style={styles.datePickerCancelButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerSaveButton}
                onPress={saveDate}
              >
                <Text style={styles.datePickerSaveText}>Guardar</Text>
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
        onConfirm={handleConfirm}
        onCancel={alertOptions.onCancel ? handleCancel : undefined}
        cancelText={alertOptions.cancelText}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: Typography.fontSize.sm,
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.xs,
  },
  notificationButton: {
    position: 'relative',
    padding: Spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  canchasContainer: {
    borderBottomWidth: 1,
    padding: Spacing.md,
  },
  canchaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  canchaSelectorText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  modalBottomSheetWidth: {
    width: '100%',
  },
  modalSheetOuterWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalSelectorContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '70%',
    ...Shadows.lg,
  },
  modalSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalSelectorTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalSelectorList: {
    maxHeight: 400,
  },
  modalSelectorOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalSelectorOptionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  horasContainer: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  horasTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  horasScroll: {
    flexDirection: 'row',
  },
  horaSlot: {
    minWidth: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    ...Shadows.sm,
  },
  horaSlotText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  todasCanchasContainer: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  canchaRowContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  canchaRowTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  noDisponibleContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  noDisponibleText: {
    fontSize: Typography.fontSize.sm,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    width: '100%',
    overflow: 'hidden',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalScroll: {
    padding: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoBoxText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  formInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  selectOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectOptionText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  selectOptionTextSelected: {
    color: Colors.background,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalButtons: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  modalButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  modalButtonDanger: {
    backgroundColor: Colors.error,
  },
  modalButtonTextPrimary: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.background,
  },
  modalButtonTextDanger: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.background,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  pickerButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  pickerButtonTextPlaceholder: {
    color: Colors.textSecondary,
  },
  timePickerContainer: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md,
    maxHeight: '70%',
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  timePickerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  timePickerContent: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  timePickerRow: {
    flex: 1,
    alignItems: 'flex-start',
  },
  timePickerLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  timePickerScroll: {
    maxHeight: 200,
  },
  timePickerOption: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    alignItems: 'center',
  },
  timePickerOptionSelected: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  timePickerOptionText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text,
  },
  timePickerOptionTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  ampmContainer: {
    flexDirection: 'column',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    width: '100%',
  },
  ampmButton: {
    width: '100%',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  ampmButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  ampmButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
  },
  ampmButtonTextSelected: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.bold,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timePickerCancelButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  timePickerSaveButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  timePickerSaveText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
  datePickerContainer: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md,
    maxHeight: '70%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  datePickerContent: {
    marginBottom: Spacing.md,
  },
  datePickerScroll: {
    maxHeight: 300,
  },
  datePickerMonthControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  datePickerMonthText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  datePickerCalendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'flex-start',
  },
  datePickerDay: {
    width: '30%',
    minWidth: 100,
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  datePickerDaySelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  datePickerDayDisabled: {
    opacity: 0.3,
  },
  datePickerDayText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
  },
  datePickerDayTextSelected: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.bold,
  },
  datePickerDayTextDisabled: {
    color: Colors.textSecondary,
  },
  datePickerDayName: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  datePickerCancelButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  datePickerCancelText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  datePickerSaveButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  datePickerSaveText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
});
