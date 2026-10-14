import React, { useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getEarliestAllowedHourToday,
  BOOKING_DAY_START_HOUR,
  BOOKING_DAY_END_HOUR,
} from '../lib/bookingWindow';

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHourLabelEs(hour24: number): string {
  const d = new Date(2000, 0, 1, hour24, 0, 0, 0);
  return d.toLocaleTimeString('es-HN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export type HourOnlyTimePickerProps = {
  value: Date;
  onHourChange: (hour24: number) => void;
  theme: 'light' | 'dark';
  /** Default true = horario de canchas. false = 0–23 h (filtros). */
  restrictToBookingHours?: boolean;
};

/**
 * Selector de hora en punto (12 h, a. m. / p. m.) sin columna de minutos.
 */
export default function HourOnlyTimePicker({
  value,
  onHourChange,
  theme,
  restrictToBookingHours = true,
}: HourOnlyTimePickerProps) {
  const timeMinimum = useMemo(() => {
    if (!restrictToBookingHours) return null;
    const n = new Date();
    if (!isSameCalendarDay(value, n)) return null;
    return getEarliestAllowedHourToday(n);
  }, [restrictToBookingHours, value]);

  const allowedHours = useMemo(() => {
    if (!restrictToBookingHours) {
      return Array.from({ length: 24 }, (_, h) => h);
    }
    if (timeMinimum === null && isSameCalendarDay(value, new Date())) {
      return [];
    }
    const minH = timeMinimum
      ? timeMinimum.getHours()
      : BOOKING_DAY_START_HOUR;
    const start = Math.max(BOOKING_DAY_START_HOUR, minH);
    const out: number[] = [];
    for (let h = start; h <= BOOKING_DAY_END_HOUR; h++) {
      out.push(h);
    }
    return out;
  }, [restrictToBookingHours, timeMinimum, value]);

  useEffect(() => {
    const h = value.getHours();
    if (allowedHours.length === 0) return;
    if (!allowedHours.includes(h)) {
      const fix =
        allowedHours.find((x) => x >= h) ?? allowedHours[allowedHours.length - 1];
      onHourChange(fix);
    }
  }, [allowedHours, value, onHourChange]);

  const selectedHour = useMemo(() => {
    const h = value.getHours();
    if (allowedHours.includes(h)) return h;
    return allowedHours[0] ?? BOOKING_DAY_START_HOUR;
  }, [value, allowedHours]);

  const handleChange = useCallback(
    (v: string | number) => {
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      if (!Number.isFinite(n)) return;
      onHourChange(n);
    },
    [onHourChange]
  );

  const isDark = theme === 'dark';
  const textColor = isDark ? '#f2f2f2' : '#111111';
  const bgColor = isDark ? '#1c1c1e' : '#ffffff';

  if (allowedHours.length === 0) {
    return (
      <View style={[styles.wrap, styles.emptyWrap, { backgroundColor: bgColor }]}>
        <Text style={[styles.emptyText, { color: textColor }]}>
          No hay horarios disponibles para hoy.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: bgColor }]}>
      <Picker
        selectedValue={selectedHour}
        onValueChange={handleChange}
        mode={Platform.OS === 'android' ? 'dropdown' : undefined}
        style={[
          styles.picker,
          { color: textColor },
          Platform.OS === 'android' ? { backgroundColor: bgColor } : null,
        ]}
        itemStyle={
          Platform.OS === 'ios'
            ? [styles.itemIOS, { color: textColor }]
            : undefined
        }
        dropdownIconColor={textColor}
      >
        {allowedHours.map((h) => (
          <Picker.Item
            key={h}
            label={formatHourLabelEs(h)}
            value={h}
            color={textColor}
          />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    ...(Platform.OS === 'ios' ? { height: 168 } : { minHeight: 48 }),
  },
  itemIOS: {
    fontSize: 17,
  },
  emptyWrap: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    minHeight: 56,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.85,
  },
});
