import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  startOfToday,
  endOfBookingWindow,
  getEarliestAllowedHourToday,
  BOOKING_DAY_START_HOUR,
  BOOKING_DAY_END_HOUR,
} from '../lib/bookingWindow';
import ReservaMesCalendarioJugador from './ReservaMesCalendarioJugador';
import FechaHoraWheelPickers from './FechaHoraWheelPickers';

export type FechaHoraNativePickersProps = {
  part: 'date' | 'time';
  draftDateTime: Date;
  setDraftDateTime: (d: Date) => void;
  pickerTheme: 'light' | 'dark';
  shellStyle?: StyleProp<ViewStyle>;
  weekdayLabelColor?: string;
};

function nombreDiaSemana(d: Date): string {
  const s = d.toLocaleDateString('es-HN', { weekday: 'long' });
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pinBetween(d: Date, minD: Date, maxD: Date): Date {
  const t = Math.min(Math.max(d.getTime(), minD.getTime()), maxD.getTime());
  return new Date(t);
}

function clampDayTimeToBusinessHours(baseDay: Date, timeSource: Date, now: Date): Date {
  const out = new Date(baseDay);
  out.setHours(timeSource.getHours(), 0, 0, 0);
  let r = out;
  const dayStart = new Date(r);
  dayStart.setHours(0, 0, 0, 0);
  const open = new Date(dayStart);
  open.setHours(BOOKING_DAY_START_HOUR, 0, 0, 0);
  const close = new Date(dayStart);
  close.setHours(BOOKING_DAY_END_HOUR, 0, 0, 0);
  if (r < open) r = open;
  if (r > close) r = close;
  if (isSameCalendarDay(r, now)) {
    const minT = getEarliestAllowedHourToday(now);
    if (minT !== null && r < minT) r = minT;
  }
  return r;
}

export default function FechaHoraNativePickers({
  part,
  draftDateTime,
  setDraftDateTime,
  pickerTheme,
  shellStyle,
  weekdayLabelColor,
}: FechaHoraNativePickersProps) {
  const minDate = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => endOfBookingWindow(), []);

  const diaSemanaColor =
    weekdayLabelColor ?? (pickerTheme === 'dark' ? '#d0d0d0' : '#444444');

  const onCalendarDay = useCallback(
    (dayStart: Date) => {
      const n = new Date();
      let merged = clampDayTimeToBusinessHours(dayStart, draftDateTime, n);
      merged = pinBetween(merged, minDate, maxDate);
      setDraftDateTime(merged);
    },
    [draftDateTime, setDraftDateTime, minDate, maxDate]
  );

  if (part === 'time') {
    return (
      <FechaHoraWheelPickers
        draftDateTime={draftDateTime}
        setDraftDateTime={setDraftDateTime}
        pickerTheme={pickerTheme}
        shellStyle={shellStyle}
      />
    );
  }

  return (
    <View style={[styles.shell, shellStyle]}>
      <Text
        style={[styles.weekdayLabel, { color: diaSemanaColor }]}
        accessibilityLabel={`Día de la semana: ${nombreDiaSemana(draftDateTime)}`}
      >
        {nombreDiaSemana(draftDateTime)}
      </Text>
      <ReservaMesCalendarioJugador
        value={draftDateTime}
        onChangeDay={onCalendarDay}
        compact
      />
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
