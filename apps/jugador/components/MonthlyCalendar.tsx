import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ReservaWithRelations } from '../lib/reservas';
import { useThemeColors } from '../hooks/useThemeColors';
import { Spacing, BorderRadius, Typography, Colors } from '../constants/theme';

interface MonthlyCalendarProps {
  reservas: ReservaWithRelations[];
  mesActual: Date;
  onMesAnterior: () => void;
  onMesSiguiente: () => void;
  onDiaPress: (fecha: Date) => void;
  diaSeleccionado?: Date | null;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function MonthlyCalendar({
  reservas,
  mesActual,
  onMesAnterior,
  onMesSiguiente,
  onDiaPress,
  diaSeleccionado,
}: MonthlyCalendarProps) {
  const colors = useThemeColors();
  // Obtener el primer día del mes
  const primerDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
  // Obtener el último día del mes
  const ultimoDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
  
  // Obtener el día de la semana del primer día (0=Domingo, 1=Lunes, etc.)
  // Convertir a 0=Lunes, 6=Domingo
  const diaSemanaPrimerDia = (primerDiaMes.getDay() + 6) % 7;
  
  // Obtener el número de días en el mes
  const diasEnMes = ultimoDiaMes.getDate();
  
  // Crear array de días del mes
  const diasMes = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  
  // Obtener conteo de reservas por día
  const getConteoReservas = (dia: number): number => {
    const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
    fecha.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fecha);
    fechaFin.setHours(23, 59, 59, 999);
    
    return reservas.filter((reserva) => {
      const reservaFecha = new Date(reserva.fecha_hora);
      return reservaFecha >= fecha && reservaFecha <= fechaFin;
    }).length;
  };
  
  // Verificar si un día es hoy
  const esHoy = (dia: number): boolean => {
    const hoy = new Date();
    return (
      dia === hoy.getDate() &&
      mesActual.getMonth() === hoy.getMonth() &&
      mesActual.getFullYear() === hoy.getFullYear()
    );
  };

  // Verificar si un día está seleccionado
  const esSeleccionado = (dia: number): boolean => {
    if (!diaSeleccionado) return false;
    const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
    fecha.setHours(0, 0, 0, 0);
    const seleccionado = new Date(diaSeleccionado);
    seleccionado.setHours(0, 0, 0, 0);
    return (
      fecha.getTime() === seleccionado.getTime()
    );
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header con mes y año */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onMesAnterior} style={styles.navButton}>
          <Text style={[styles.navText, { color: Colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.text }]}>
          {NOMBRES_MESES[mesActual.getMonth()]} {mesActual.getFullYear()}
        </Text>
        <TouchableOpacity onPress={onMesSiguiente} style={styles.navButton}>
          <Text style={[styles.navText, { color: Colors.primary }]}>›</Text>
        </TouchableOpacity>
      </View>
      
      {/* Días de la semana */}
      <View style={styles.diasSemanaContainer}>
        {DIAS_SEMANA.map((dia) => (
          <View key={dia} style={styles.diaSemana}>
            <Text style={[styles.diaSemanaText, { color: colors.textSecondary }]}>{dia}</Text>
          </View>
        ))}
      </View>
      
      {/* Calendario */}
      <View style={styles.calendarioContainer}>
        {/* Días vacíos al inicio */}
        {Array.from({ length: diaSemanaPrimerDia }, (_, i) => (
          <View key={`empty-${i}`} style={styles.diaVacio} />
        ))}
        
        {/* Días del mes */}
        {diasMes.map((dia) => {
          const conteo = getConteoReservas(dia);
          const esHoyDia = esHoy(dia);
          const esSeleccionadoDia = esSeleccionado(dia);
          const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
          fecha.setHours(0, 0, 0, 0);
          
          // Priorizar el día seleccionado sobre el día actual
          const tieneFoco = esSeleccionadoDia || (esHoyDia && !diaSeleccionado);
          
          return (
            <TouchableOpacity
              key={dia}
              style={[
                styles.dia,
                {
                  backgroundColor: tieneFoco ? Colors.primary + '20' : colors.surface,
                  borderColor: tieneFoco ? Colors.primary : colors.border,
                  borderWidth: tieneFoco ? 2 : 1,
                }
              ]}
              onPress={() => {
                const fechaCompleta = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
                fechaCompleta.setHours(0, 0, 0, 0);
                onDiaPress(fechaCompleta);
              }}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <Text style={[
                styles.diaNumero,
                {
                  color: tieneFoco ? Colors.primary : colors.text,
                  fontWeight: tieneFoco ? Typography.fontWeight.bold : Typography.fontWeight.medium,
                }
              ]}>
                {dia}
              </Text>
              {conteo > 0 && (
                <View style={[styles.badge, { backgroundColor: Colors.primary }]}>
                  <Text style={[styles.badgeText, { color: Colors.textInverse }]}>{conteo}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        
        {/* Días vacíos al final para completar la última semana */}
        {(() => {
          const totalCeldas = diaSemanaPrimerDia + diasEnMes;
          const diasVaciosFinal = totalCeldas % 7 === 0 ? 0 : 7 - (totalCeldas % 7);
          return Array.from({ length: diasVaciosFinal }, (_, i) => (
            <View key={`empty-end-${i}`} style={styles.diaVacio} />
          ));
        })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    margin: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  navButton: {
    padding: Spacing.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  navText: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
  },
  monthText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  diasSemanaContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  diaSemana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  diaSemanaText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  calendarioContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  diaVacio: {
    width: '14.285714%',
    aspectRatio: 1,
    padding: Spacing.xs,
  },
  dia: {
    width: '14.275714%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xs,
    position: 'relative',
    borderRadius: BorderRadius.sm,
    margin: 0,
    minHeight: 40,
  },
  diaNumero: {
    fontSize: Typography.fontSize.md,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
});


