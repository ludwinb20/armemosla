/** Inicio del día local actual (00:00:00.000). */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Redondea a la hora local en punto más cercana (≥30 min sube a la siguiente hora).
 * Útil cuando el picker nativo solo permite medias horas pero la búsqueda es por hora entera.
 */
export function snapToNearestWholeHour(date: Date): Date {
  const d = new Date(date);
  const mins = d.getMinutes();
  if (mins >= 30) {
    d.setHours(d.getHours() + 1);
  }
  d.setMinutes(0, 0, 0);
  d.setSeconds(0, 0);
  return d;
}

/** Primera marca en punto (hora local) con instante ≥ date. */
export function ceilToWholeHour(date: Date): Date {
  const out = new Date(date);
  out.setMinutes(0, 0, 0);
  out.setSeconds(0, 0);
  out.setMilliseconds(0);
  if (out.getTime() < date.getTime()) {
    out.setHours(out.getHours() + 1);
  }
  return out;
}

/** Primera y última hora en punto habituales para reservas (mismo criterio que los pickers). */
export const BOOKING_DAY_START_HOUR = 6;
export const BOOKING_DAY_END_HOUR = 23;

/**
 * Si la fecha elegida es el día calendario actual: primera hora en punto permitida
 * es `ceil(ahora + 1 h)` (mínimo a las 6:00 del día).
 * Si ya no cabe ninguna hora ese día (p. ej. muy tarde), devuelve `null`.
 */
export function getEarliestAllowedHourToday(now: Date = new Date()): Date | null {
  const minOk = new Date(now.getTime() + 60 * 60 * 1000);
  let d = ceilToWholeHour(minOk);

  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();

  if (d.getFullYear() !== y || d.getMonth() !== m || d.getDate() !== day) {
    return null;
  }

  const open = new Date(y, m, day, BOOKING_DAY_START_HOUR, 0, 0, 0);
  if (d < open) {
    d = open;
  }

  const lastSlot = new Date(y, m, day, BOOKING_DAY_END_HOUR, 0, 0, 0);
  if (d.getTime() > lastSlot.getTime()) {
    return null;
  }

  return d;
}

/**
 * Último instante elegible para reservar: fin del día (23:59:59.999)
 * exactamente 3 meses después de hoy (mismo día del mes cuando existe).
 */
export function endOfBookingWindow(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  d.setHours(23, 59, 59, 999);
  return d;
}
