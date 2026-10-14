import React, { useCallback } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import ReservaMesCalendarioJugador from './ReservaMesCalendarioJugador';

export type FiltroFechaPickerProps = {
  value: Date;
  onChangeDay: (dayStart: Date) => void;
  shellStyle?: StyleProp<ViewStyle>;
  weekdayLabelColor?: string;
};

function nombreDiaSemana(d: Date): string {
  const s = d.toLocaleDateString('es-HN', { weekday: 'long' });
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  }
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendario solo-fecha para filtros (sin reglas de horario de reserva). */
export default function FiltroFechaPicker({
  value,
  onChangeDay,
  shellStyle,
  weekdayLabelColor = '#444444',
}: FiltroFechaPickerProps) {
  const safeValue = startOfDay(value);

  const handleChangeDay = useCallback(
    (dayStart: Date) => {
      onChangeDay(startOfDay(dayStart));
    },
    [onChangeDay]
  );

  return (
    <View style={[styles.shell, shellStyle]}>
      <Text
        style={[styles.weekdayLabel, { color: weekdayLabelColor }]}
        accessibilityLabel={`Día de la semana: ${nombreDiaSemana(safeValue)}`}
      >
        {nombreDiaSemana(safeValue)}
      </Text>
      <ReservaMesCalendarioJugador value={safeValue} onChangeDay={handleChangeDay} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  weekdayLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
});
