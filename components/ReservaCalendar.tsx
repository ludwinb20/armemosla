import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Colors, Typography, Spacing } from '../constants/theme';
import { ReservaWithRelations } from '../lib/reservas';

interface CanchaColor {
  id: string;
  nombre?: string;
  color: string;
}

interface ReservaCalendarProps {
  reservas: ReservaWithRelations[];
  canchas: CanchaColor[];
  semanaInicio: Date;
  onReservaPress?: (reserva: ReservaWithRelations) => void;
  onSlotPress?: (canchaId: string, fechaHora: Date) => void;
  horaInicio?: number; // Hora de inicio del calendario (default: 0)
  horaFin?: number; // Hora de fin del calendario (default: 23)
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Horas de 0 (12:00 AM) a 23 (11:00 PM), invertidas para mostrar noche arriba y mañana abajo
const HORAS_DIA = Array.from({ length: 24 }, (_, i) => 23 - i); // 23, 22, 21, ..., 1, 0 (11:00 PM a 12:00 AM)

export default function ReservaCalendar({
  reservas,
  canchas,
  semanaInicio,
  onReservaPress,
  onSlotPress,
  horaInicio = 0,
  horaFin = 23,
}: ReservaCalendarProps) {
  // Calcular los días de la semana
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(semanaInicio);
    fecha.setDate(semanaInicio.getDate() + i);
    return fecha;
  });

  // Obtener el nombre de una cancha
  const getCanchaNombre = (canchaId: string): string => {
    const cancha = canchas.find((c) => c.id === canchaId);
    return cancha?.nombre || 'Cancha';
  };

  // Obtener el color según el estado de la reserva
  const getEstadoColor = (estado: string): string => {
    switch (estado) {
      case 'pendiente':
        return Colors.primary; // Verde
      case 'completada':
        return Colors.secondary; // Azul
      case 'cancelada':
        return Colors.error; // Rojo
      default:
        return Colors.primary; // Verde por defecto
    }
  };

  // Obtener reservas para un día y hora específicos
  const getReservasEnSlot = (dia: Date, hora: number): ReservaWithRelations[] => {
    // Obtener año, mes y día del día del calendario
    const diaYear = dia.getFullYear();
    const diaMonth = dia.getMonth();
    const diaDate = dia.getDate();

    return reservas.filter((reserva) => {
      const reservaFecha = new Date(reserva.fecha_hora);
      
      // Comparar año, mes y día directamente
      const mismoDia =
        reservaFecha.getFullYear() === diaYear &&
        reservaFecha.getMonth() === diaMonth &&
        reservaFecha.getDate() === diaDate;
      
      // Obtener la hora en hora local
      const reservaHour = reservaFecha.getHours();
      
      // Verificar que la hora de inicio de la reserva esté en este slot
      return mismoDia && reservaHour === hora;
    });
  };

  // Formatear hora en formato 12 horas
  const formatHora = (hora: number): string => {
    if (hora === 0) return '12 AM';
    if (hora < 12) return `${hora} AM`;
    if (hora === 12) return '12 PM';
    return `${hora - 12} PM`;
  };

  // Formatear fecha
  const formatFecha = (fecha: Date): string => {
    return fecha.toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });
  };

  // Calcular anchos de columnas
  const screenWidth = Dimensions.get('window').width;
  const HORA_COLUMNA_WIDTH = 60; // Ancho fijo para la columna de horas
  const BORDER_WIDTH = 1; // Ancho del borde izquierdo de cada columna
  const NUM_DIAS = 7;
  // Ancho disponible para las columnas de días (pantalla completa menos columna de horas y todos los bordes izquierdos)
  const anchoDisponible = screenWidth - HORA_COLUMNA_WIDTH - (NUM_DIAS * BORDER_WIDTH);
  const anchoColumnaDia = anchoDisponible / NUM_DIAS;

  return (
    <View style={styles.container}>
      {/* Encabezado con días de la semana */}
      <View style={styles.header}>
        <View style={[styles.horaColumna, { width: HORA_COLUMNA_WIDTH }]} />
        {diasSemana.map((dia, index) => (
          <View 
            key={index} 
            style={[
              styles.diaHeader, 
              { 
                width: anchoColumnaDia,
                borderLeftWidth: BORDER_WIDTH,
              }
            ]}
          >
            <Text style={styles.diaNombre}>{DIAS_SEMANA[index]}</Text>
            <Text style={styles.diaFecha}>{formatFecha(dia)}</Text>
          </View>
        ))}
      </View>

      {/* Calendario con scroll vertical */}
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        {HORAS_DIA.map((hora) => (
          <View key={hora} style={styles.filaHora}>
            {/* Columna de horas */}
            <View style={[styles.horaColumna, { width: HORA_COLUMNA_WIDTH }]}>
              <Text style={styles.horaTexto}>{formatHora(hora)}</Text>
            </View>

            {/* Celdas de cada día */}
            {diasSemana.map((dia, diaIndex) => {
              const reservasEnSlot = getReservasEnSlot(dia, hora);
              const fechaHora = new Date(dia);
              fechaHora.setHours(hora, 0, 0, 0);

              return (
                <TouchableOpacity
                  key={diaIndex}
                  style={[
                    styles.celda,
                    {
                      width: anchoColumnaDia,
                      borderLeftWidth: BORDER_WIDTH,
                    }
                  ]}
                  onPress={() => {
                    if (reservasEnSlot.length > 0 && onReservaPress) {
                      onReservaPress(reservasEnSlot[0]);
                    } else if (onSlotPress) {
                      // Obtener la primera cancha disponible si no hay cancha seleccionada
                      const primeraCancha = canchas.length > 0 ? canchas[0].id : '';
                      onSlotPress(primeraCancha, fechaHora);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {reservasEnSlot.map((reserva, reservaIndex) => {
                    const canchaNombre = getCanchaNombre(reserva.cancha_id);
                    const estadoColor = getEstadoColor(reserva.estado);

                    return (
                      <TouchableOpacity
                        key={reserva.id}
                        style={[
                          styles.reservaBlock,
                          {
                            backgroundColor: estadoColor,
                            opacity: reserva.estado === 'cancelada' ? 0.5 : 1,
                            marginBottom: reservaIndex < reservasEnSlot.length - 1 ? 2 : 0,
                          },
                        ]}
                        onPress={() => onReservaPress && onReservaPress(reserva)}
                      >
                        <Text style={styles.reservaNombre} numberOfLines={1}>
                          {canchaNombre}
                        </Text>
                        {/* Solo mostrar hora y estado si la reserva está pendiente */}
                        {(reserva.estado === 'pendiente') && (
                          <>
                            <Text style={styles.reservaHora} numberOfLines={1}>
                              {new Date(reserva.fecha_hora).toLocaleTimeString('es-HN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'stretch',
  },
  horaColumna: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    flexShrink: 0,
  },
  diaHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderLeftColor: Colors.border,
  },
  diaNombre: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  diaFecha: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  filaHora: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'stretch',
  },
  horaTexto: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  celda: {
    borderLeftColor: Colors.border,
    padding: 2,
    minHeight: 60,
  },
  reservaBlock: {
    padding: 4,
    borderRadius: 4,
    marginBottom: 2,
  },
  reservaNombre: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.background,
    marginBottom: 2,
  },
  reservaHora: {
    fontSize: Typography.fontSize.xs,
    color: Colors.background,
    opacity: 0.9,
  },
  reservaEstado: {
    fontSize: Typography.fontSize.xs,
    color: Colors.background,
    fontStyle: 'italic',
    marginTop: 2,
  },
});

