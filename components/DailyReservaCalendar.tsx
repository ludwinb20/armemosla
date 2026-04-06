import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../constants/theme';
import { ReservaWithRelations } from '../lib/reservas';
import { useThemeColors } from '../hooks/useThemeColors';

interface CanchaColor {
  id: string;
  nombre?: string;
  color: string;
}

interface DailyReservaCalendarProps {
  reservas: ReservaWithRelations[];
  canchas: CanchaColor[];
  fecha: Date;
  onReservaPress?: (reserva: ReservaWithRelations) => void;
  onSlotPress?: (canchaId: string, fechaHora: Date) => void;
}

// Horas de 0 (12:00 AM) a 23 (11:00 PM), invertidas para mostrar noche arriba y mañana abajo
const HORAS_DIA = Array.from({ length: 24 }, (_, i) => 23 - i); // 23, 22, 21, ..., 1, 0 (11:00 PM a 12:00 AM)

export default function DailyReservaCalendar({
  reservas,
  canchas,
  fecha,
  onReservaPress,
  onSlotPress,
}: DailyReservaCalendarProps) {
  const colors = useThemeColors();
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

  // Obtener reservas para una hora específica
  const getReservasEnSlot = (hora: number): ReservaWithRelations[] => {
    const diaYear = fecha.getFullYear();
    const diaMonth = fecha.getMonth();
    const diaDate = fecha.getDate();

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

  // Calcular anchos de columnas
  const screenWidth = Dimensions.get('window').width;
  const HORA_COLUMNA_WIDTH = 60;
  const BORDER_WIDTH = 1;
  const anchoDisponible = screenWidth - HORA_COLUMNA_WIDTH - BORDER_WIDTH;
  const anchoColumna = anchoDisponible;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Encabezado con fecha */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.horaHeaderCell, { width: HORA_COLUMNA_WIDTH }]} />
        <View style={[styles.diaHeaderCell, { width: anchoColumna, borderLeftColor: colors.border }]}>
          <Text style={[styles.fechaText, { color: colors.text }]}>
            {fecha.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Calendario con scroll vertical */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {HORAS_DIA.map((hora) => {
          const reservasEnSlot = getReservasEnSlot(hora);
          const fechaHora = new Date(fecha);
          fechaHora.setHours(hora, 0, 0, 0);

          return (
            <View key={hora} style={[styles.filaHora, { borderBottomColor: colors.border }]}>
              {/* Columna de horas */}
              <View style={[styles.horaCell, { width: HORA_COLUMNA_WIDTH }]}>
                <Text style={[styles.horaText, { color: colors.textSecondary }]}>{formatHora(hora)}</Text>
              </View>

              {/* Celda del día */}
              <TouchableOpacity
                style={[
                  styles.celdaDia,
                  {
                    width: anchoColumna,
                    borderLeftWidth: BORDER_WIDTH,
                    borderLeftColor: colors.border,
                  }
                ]}
                onPress={() => {
                  if (reservasEnSlot.length > 0 && onReservaPress) {
                    onReservaPress(reservasEnSlot[0]);
                  } else if (onSlotPress) {
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
                        }
                      ]}
                      onPress={() => onReservaPress && onReservaPress(reserva)}
                    >
                      <Text style={[styles.reservaNombre, { color: Colors.textInverse }]} numberOfLines={1}>
                        {canchaNombre}
                      </Text>
                      {/* Solo mostrar hora si la reserva está pendiente */}
                      {(reserva.estado === 'pendiente') && (
                        <Text style={[styles.reservaHora, { color: Colors.textInverse }]} numberOfLines={1}>
                          {new Date(reserva.fecha_hora).toLocaleTimeString('es-HN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'stretch',
  },
  horaHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    flexShrink: 0,
  },
  diaHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderLeftWidth: 1,
  },
  fechaText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  filaHora: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    alignItems: 'stretch',
  },
  horaCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    flexShrink: 0,
  },
  horaText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  celdaDia: {
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
    marginBottom: 2,
  },
  reservaHora: {
    fontSize: Typography.fontSize.xs,
    opacity: 0.9,
  },
});



