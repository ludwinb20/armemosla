/**
 * Selector de fecha/hora con ruedas (react-native-date-picker).
 * Se mantiene para poder volver a usarlo si se prefiere frente al calendario mensual.
 */
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { startOfToday, endOfBookingWindow } from '../lib/bookingWindow';

const SLOT_MINUTES = 30;
const TIME_START_HOUR = 6;
const TIME_END_HOUR = 23;

const USE_NATIVE_MIN_MAX = Platform.OS !== 'android';

export type FechaHoraWheelPickersProps = {
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

export default function FechaHoraWheelPickers({
  part,
  draftDateTime,
  setDraftDateTime,
  pickerTheme,
  shellStyle,
  weekdayLabelColor,
}: FechaHoraWheelPickersProps) {
  const minDate = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => endOfBookingWindow(), []);

  const timeMinimum = useMemo(() => {
    const n = new Date();
    if (!isSameCalendarDay(draftDateTime, n)) return undefined;
    return earliestAllowedTodaySlot(n);
  }, [draftDateTime]);

  const theme = pickerTheme === 'dark' ? 'dark' : 'light';
  const diaSemanaColor =
    weekdayLabelColor ?? (pickerTheme === 'dark' ? '#d0d0d0' : '#444444');

  const onDateChange = useCallback(
    (selected: Date) => {
      const n = new Date();
      let merged = clampDayTimeToBusinessHours(selected, draftDateTime, n);
      if (!USE_NATIVE_MIN_MAX) {
        merged = pinBetween(merged, minDate, maxDate);
      }
      setDraftDateTime(merged);
    },
    [draftDateTime, setDraftDateTime, minDate, maxDate]
  );

  const onTimeChange = useCallback(
    (selected: Date) => {
      const n = new Date();
      let merged = clampDayTimeToBusinessHours(draftDateTime, selected, n);
      if (!USE_NATIVE_MIN_MAX) {
        merged = pinBetween(merged, minDate, maxDate);
      }
      setDraftDateTime(merged);
    },
    [draftDateTime, setDraftDateTime, minDate, maxDate]
  );

  const rangeDateProps = USE_NATIVE_MIN_MAX
    ? { minimumDate: minDate, maximumDate: maxDate }
    : {};

  const rangeTimeProps =
    USE_NATIVE_MIN_MAX && timeMinimum ? { minimumDate: timeMinimum } : {};

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.shell, shellStyle]}>
        <Text style={styles.webFallbackText}>
          El selector nativo no está disponible en web. Usá la app en Android o iOS.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.shell, shellStyle]}>
      {part === 'date' ? (
        <>
          <Text
            style={[styles.weekdayLabel, { color: diaSemanaColor }]}
            accessibilityLabel={`Día de la semana: ${nombreDiaSemana(draftDateTime)}`}
          >
            {nombreDiaSemana(draftDateTime)}
          </Text>
          <DatePicker
            date={draftDateTime}
            onDateChange={onDateChange}
            mode="date"
            theme={theme}
            locale="es"
            {...rangeDateProps}
          />
        </>
      ) : (
        <DatePicker
          date={draftDateTime}
          onDateChange={onTimeChange}
          mode="time"
          theme={theme}
          locale="es"
          minuteInterval={SLOT_MINUTES}
          {...rangeTimeProps}
        />
      )}
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
  webFallbackText: {
    fontSize: 14,
    opacity: 0.85,
  },
});
