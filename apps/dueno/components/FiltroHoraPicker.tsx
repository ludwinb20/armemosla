import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

function formatHourLabelEs(hour24: number): string {
  const d = new Date(2000, 0, 1, hour24, 0, 0, 0);
  return d.toLocaleTimeString('es-HN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export type FiltroHoraPickerProps = {
  hour24: number;
  onHourChange: (hour24: number) => void;
  theme: 'light' | 'dark';
  minHour?: number;
  maxHour?: number;
};

/** Selector de hora (0–23) para filtros, sin restricciones de horario de cancha. */
export default function FiltroHoraPicker({
  hour24,
  onHourChange,
  theme,
  minHour = 0,
  maxHour = 23,
}: FiltroHoraPickerProps) {
  const allowedHours = useMemo(() => {
    const out: number[] = [];
    for (let h = minHour; h <= maxHour; h++) out.push(h);
    return out;
  }, [minHour, maxHour]);

  const selectedHour = allowedHours.includes(hour24) ? hour24 : (allowedHours[0] ?? 0);

  const handleChange = useCallback(
    (v: string | number) => {
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      if (Number.isFinite(n)) onHourChange(n);
    },
    [onHourChange]
  );

  const isDark = theme === 'dark';
  const textColor = isDark ? '#f2f2f2' : '#111111';
  const bgColor = isDark ? '#1c1c1e' : '#ffffff';

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
        itemStyle={Platform.OS === 'ios' ? [styles.itemIOS, { color: textColor }] : undefined}
        dropdownIconColor={textColor}
      >
        {allowedHours.map((h) => (
          <Picker.Item key={h} label={formatHourLabelEs(h)} value={h} color={textColor} />
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
});
