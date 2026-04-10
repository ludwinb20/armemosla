import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { startOfToday, endOfBookingWindow } from '../lib/bookingWindow';
import ReservaMesCalendarioJugador from './ReservaMesCalendarioJugador';
import FechaHoraWheelPickers from './FechaHoraWheelPickers';

const SLOT_MINUTES = 30;
const TIME_START_HOUR = 6;
const TIME_END_HOUR = 23;

export type FechaHoraNativePickersProps = {
  part: 'date' | 'time';
  draftDateTime: Date;
  setDraftDateTime: (d: Date) => void;
  pickerTheme: 'light' | 'dark';
  shellStyle?: StyleProp<ViewStyle>;
  weekdayLabelColor?: string;
  /**
   * Solo aplica a `part="date"`: calendario mensual (por defecto) o ruedas nativas.
   * La hora sigue usando siempre el picker de ruedas.
   */
  dateSelectionMode?: 'calendar' | 'wheel';
};

function nombreDiaSemana(d: Date): string {
  const s = d.toLocaleDateString('es-HN', { weekday: 'long' });
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function roundToSlot(date: Date): Date {
  const ms = SLOT_MINUTES * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function earliestAllowedTodaySlot(now: Date): Date {
  const minOk = new Date(now.getTime() + 5 * 60 * 1000);
  let d = roundToSlot(minOk);
  const dayStart = startOfToday();
  const six = new Date(dayStart);
  six.setHours(TIME_START_HOUR, 0, 0, 0);
  if (d < six) d = new Date(six);
  return d;
}

function pinBetween(d: Date, minD: Date, maxD: Date): Date {
  const t = Math.min(Math.max(d.getTime(), minD.getTime()), maxD.getTime());
  return new Date(t);
}

function clampDayTimeToBusinessHours(baseDay: Date, timeSource: Date, now: Date): Date {
  const out = new Date(baseDay);
  out.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );
  let r = roundToSlot(out);
  const dayStart = new Date(r);
  dayStart.setHours(0, 0, 0, 0);
  const open = new Date(dayStart);
  open.setHours(TIME_START_HOUR, 0, 0, 0);
  const close = new Date(dayStart);
  close.setHours(TIME_END_HOUR, 0, 0, 0);
  if (r < open) r = open;
  if (r > close) r = close;
  if (isSameCalendarDay(r, now)) {
    const minT = earliestAllowedTodaySlot(now);
    if (r < minT) r = minT;
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
  dateSelectionMode = 'calendar',
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
        part="time"
        draftDateTime={draftDateTime}
        setDraftDateTime={setDraftDateTime}
        pickerTheme={pickerTheme}
        shellStyle={shellStyle}
      />
    );
  }

  if (dateSelectionMode === 'wheel') {
    return (
      <FechaHoraWheelPickers
        part="date"
        draftDateTime={draftDateTime}
        setDraftDateTime={setDraftDateTime}
        pickerTheme={pickerTheme}
        shellStyle={shellStyle}
        weekdayLabelColor={weekdayLabelColor}
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
