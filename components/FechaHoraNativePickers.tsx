import React from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const SLOT_MINUTES = 30;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfBookingWindow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  d.setHours(23, 59, 59, 999);
  return d;
}

function minimumTimeForDateIfToday(selected: Date): Date | undefined {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const s0 = new Date(selected);
  s0.setHours(0, 0, 0, 0);
  if (s0.getTime() !== t0.getTime()) return undefined;
  return new Date();
}

function roundToSlot(date: Date): Date {
  const ms = SLOT_MINUTES * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

export type FechaHoraNativePickersProps = {
  draftDateTime: Date;
  setDraftDateTime: React.Dispatch<React.SetStateAction<Date>>;
  pickerTheme: 'light' | 'dark';
  shellStyle: StyleProp<ViewStyle>;
  /** Un picker por instancia para poder etiquetar Fecha / Hora en el padre. */
  part: 'date' | 'time';
};

/**
 * Cargado con React.lazy desde la pantalla de búsqueda para no romper
 * la evaluación del route si el binario aún no incluye RNCDatePicker.
 */
export default function FechaHoraNativePickers({
  draftDateTime,
  setDraftDateTime,
  pickerTheme,
  shellStyle,
  part,
}: FechaHoraNativePickersProps) {
  if (part === 'date') {
    return (
      <View style={shellStyle}>
        <DateTimePicker
          value={draftDateTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          locale="es-HN"
          themeVariant={pickerTheme}
          minimumDate={startOfToday()}
          maximumDate={endOfBookingWindow()}
          onChange={(_, date) => {
            if (!date) return;
            setDraftDateTime((prev) => {
              const next = new Date(date);
              next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
              return roundToSlot(next);
            });
          }}
        />
      </View>
    );
  }

  return (
    <View style={shellStyle}>
      <DateTimePicker
        value={draftDateTime}
        mode="time"
        display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
        locale="es-HN"
        themeVariant={pickerTheme}
        {...(Platform.OS === 'ios' ? { minuteInterval: SLOT_MINUTES } : {})}
        {...(Platform.OS === 'ios' ? { minimumDate: minimumTimeForDateIfToday(draftDateTime) } : {})}
        onChange={(_, picked) => {
          if (!picked) return;
          setDraftDateTime((prev) => {
            const next = new Date(prev);
            next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            return roundToSlot(next);
          });
        }}
      />
    </View>
  );
}
