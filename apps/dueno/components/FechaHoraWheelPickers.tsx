/**
 * Selector de hora (solo horas en punto, 12 h). La fecha se elige con el calendario en FechaHoraNativePickers.
 */
import React, { useMemo, useCallback } from 'react';
import { View, Text, Platform, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  startOfToday,
  endOfBookingWindow,
  getEarliestAllowedHourToday,
  BOOKING_DAY_START_HOUR,
  BOOKING_DAY_END_HOUR,
} from '../lib/bookingWindow';
import HourOnlyTimePicker from './HourOnlyTimePicker';

const USE_NATIVE_MIN_MAX = Platform.OS !== 'android';

export type FechaHoraWheelPickersProps = {
  draftDateTime: Date;
  setDraftDateTime: (d: Date) => void;
  pickerTheme: 'light' | 'dark';
  shellStyle?: StyleProp<ViewStyle>;
};

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

export default function FechaHoraWheelPickers({
  draftDateTime,
  setDraftDateTime,
  pickerTheme,
  shellStyle,
}: FechaHoraWheelPickersProps) {
  const minDate = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => endOfBookingWindow(), []);

  const onHourPicked = useCallback(
    (hour24: number) => {
      const n = new Date();
      const timeSource = new Date(2000, 0, 1, hour24, 0, 0, 0);
      let merged = clampDayTimeToBusinessHours(draftDateTime, timeSource, n);
      if (!USE_NATIVE_MIN_MAX) {
        merged = pinBetween(merged, minDate, maxDate);
      }
      setDraftDateTime(merged);
    },
    [draftDateTime, setDraftDateTime, minDate, maxDate]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.shell, shellStyle]}>
        <Text style={styles.webFallbackText}>
          El selector de hora no está disponible en web. Usá la app en Android o iOS.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.shell, shellStyle]}>
      <HourOnlyTimePicker
        value={draftDateTime}
        onHourChange={onHourPicked}
        theme={pickerTheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  webFallbackText: {
    fontSize: 14,
    opacity: 0.85,
  },
});
