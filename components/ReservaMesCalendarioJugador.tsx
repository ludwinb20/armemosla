/**
 * Calendario mensual para elegir día de reserva (jugador).
 * Basado en la grilla de MonthlyCalendar del panel admin, sin badges de conteo.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { Spacing, BorderRadius, Typography, Colors } from '../constants/theme';
import {
  startOfToday,
  endOfBookingWindow,
  getEarliestAllowedHourToday,
} from '../lib/bookingWindow';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type Props = {
  /** Fecha/hora actual del borrador (define mes visible y día seleccionado). */
  value: Date;
  onChangeDay: (dayStart: Date) => void;
  /** Menos padding/márgenes para modal */
  compact?: boolean;
};

export default function ReservaMesCalendarioJugador({
  value,
  onChangeDay,
  compact = true,
}: Props) {
  const colors = useThemeColors();
  const minDate = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => endOfBookingWindow(), []);

  const [mesVisible, setMesVisible] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1)
  );

  useEffect(() => {
    const m = value.getMonth();
    const y = value.getFullYear();
    setMesVisible((prev) => {
      if (prev.getMonth() === m && prev.getFullYear() === y) return prev;
      return new Date(y, m, 1);
    });
  }, [value]);

  const primerDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
  const ultimoDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0);
  const diaSemanaPrimerDia = (primerDiaMes.getDay() + 6) % 7;
  const diasEnMes = ultimoDiaMes.getDate();
  const diasMes = Array.from({ length: diasEnMes }, (_, i) => i + 1);

  const startMinMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const startMaxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const startMesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);

  const puedeMesAnterior = startMesVisible.getTime() > startMinMonth.getTime();
  const puedeMesSiguiente = startMesVisible.getTime() < startMaxMonth.getTime();

  const esEsteDiaEsHoy = (dia: number): boolean => {
    const hoy = new Date();
    return (
      dia === hoy.getDate() &&
      mesVisible.getMonth() === hoy.getMonth() &&
      mesVisible.getFullYear() === hoy.getFullYear()
    );
  };

  const esDiaDisabled = (dia: number): boolean => {
    const fecha = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), dia);
    fecha.setHours(0, 0, 0, 0);
    const t = fecha.getTime();
    if (t < startOfDay(minDate).getTime() || t > startOfDay(maxDate).getTime()) {
      return true;
    }
    if (esEsteDiaEsHoy(dia) && getEarliestAllowedHourToday() === null) {
      return true;
    }
    return false;
  };

  const esSeleccionado = (dia: number): boolean => {
    return (
      dia === value.getDate() &&
      mesVisible.getMonth() === value.getMonth() &&
      mesVisible.getFullYear() === value.getFullYear()
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        compact && styles.containerCompact,
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(mesVisible);
            d.setMonth(d.getMonth() - 1);
            setMesVisible(d);
          }}
          style={styles.navButton}
          disabled={!puedeMesAnterior}
          accessibilityLabel="Mes anterior"
        >
          <Text
            style={[
              styles.navText,
              { color: puedeMesAnterior ? Colors.primary : colors.textSecondary },
            ]}
          >
            ‹
          </Text>
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.text }]}>
          {NOMBRES_MESES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
        </Text>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(mesVisible);
            d.setMonth(d.getMonth() + 1);
            setMesVisible(d);
          }}
          style={styles.navButton}
          disabled={!puedeMesSiguiente}
          accessibilityLabel="Mes siguiente"
        >
          <Text
            style={[
              styles.navText,
              { color: puedeMesSiguiente ? Colors.primary : colors.textSecondary },
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.diasSemanaContainer}>
        {DIAS_SEMANA.map((dia) => (
          <View key={dia} style={styles.diaSemana}>
            <Text style={[styles.diaSemanaText, { color: colors.textSecondary }]}>{dia}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarioContainer}>
        {Array.from({ length: diaSemanaPrimerDia }, (_, i) => (
          <View key={`empty-${i}`} style={styles.diaVacio} />
        ))}

        {diasMes.map((dia) => {
          const disabled = esDiaDisabled(dia);
          const sel = esSeleccionado(dia);

          const estiloDia = (() => {
            if (disabled) {
              return {
                backgroundColor: colors.background,
                borderColor: colors.borderLight,
                borderWidth: 1,
                textColor: colors.textSecondary,
                fontWeight: Typography.fontWeight.medium as '500',
              };
            }
            if (sel) {
              return {
                backgroundColor: Colors.primary + '33',
                borderColor: Colors.primary,
                borderWidth: 2,
                textColor: Colors.primary,
                fontWeight: Typography.fontWeight.bold as '700',
              };
            }
            return {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              textColor: colors.text,
              fontWeight: Typography.fontWeight.medium as '500',
            };
          })();

          return (
            <TouchableOpacity
              key={dia}
              style={[
                styles.dia,
                {
                  backgroundColor: estiloDia.backgroundColor,
                  borderColor: estiloDia.borderColor,
                  borderWidth: estiloDia.borderWidth,
                  opacity: disabled ? 0.38 : 1,
                },
              ]}
              onPress={() => {
                if (disabled) return;
                const fechaCompleta = new Date(
                  mesVisible.getFullYear(),
                  mesVisible.getMonth(),
                  dia
                );
                fechaCompleta.setHours(0, 0, 0, 0);
                onChangeDay(fechaCompleta);
              }}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.diaNumero,
                  {
                    color: estiloDia.textColor,
                    fontWeight: estiloDia.fontWeight,
                  },
                ]}
              >
                {dia}
              </Text>
            </TouchableOpacity>
          );
        })}

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
  },
  containerCompact: {
    margin: 0,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  diasSemanaContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  diaSemana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  diaSemanaText: {
    fontSize: Typography.fontSize.xs,
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
    padding: 2,
  },
  dia: {
    width: '14.285714%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    borderRadius: BorderRadius.sm,
    minHeight: 36,
  },
  diaNumero: {
    fontSize: Typography.fontSize.sm,
  },
});
