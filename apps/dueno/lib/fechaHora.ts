/**
 * Fechas de reservas: siempre interpretar y mostrar en hora de Honduras.
 * Evita desfases cuando el dispositivo/emulador no está en America/Tegucigalpa.
 */

export const APP_TIMEZONE = 'America/Tegucigalpa';
export const HN_UTC_OFFSET = '-06:00';

export type FechaHoraPartesHN = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD del instante en Honduras. */
export function formatLocalDateYMD(date: Date | string, timeZone = APP_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

/** Partes de calendario y reloj en Honduras para un ISO UTC. */
export function getPartesHN(isoOrDate: string | Date): FechaHoraPartesHN {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);

  const num = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour: num('hour') % 24,
    minute: num('minute'),
  };
}

/** Convierte fecha YYYY-MM-DD + hora local HN a ISO UTC (para guardar en Supabase). */
export function localHNToUtcIso(dateYmd: string, hour: number, minute: number): string {
  const [y, m, d] = dateYmd.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) {
    throw new Error('Fecha inválida');
  }
  const local = `${y}-${pad2(m)}-${pad2(d)}T${pad2(hour)}:${pad2(minute)}:00${HN_UTC_OFFSET}`;
  return new Date(local).toISOString();
}

/** Mismo día calendario en Honduras. */
export function sameCalendarDayInHN(a: Date | string, b: Date | string): boolean {
  return formatLocalDateYMD(new Date(a)) === formatLocalDateYMD(new Date(b));
}

/** 0 = lunes … 6 = domingo (mismo criterio que cancha_disponibilidad). */
export function getDiaSemanaHN(isoOrDate: string | Date): number {
  const { year, month, day } = getPartesHN(isoOrDate);
  const noon = new Date(`${year}-${pad2(month)}-${pad2(day)}T12:00:00${HN_UTC_OFFSET}`);
  const jsDay = noon.getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Hora en punto (0–23) en Honduras para ubicar la reserva en el calendario. */
export function getHourInHN(isoOrDate: string | Date): number {
  return getPartesHN(isoOrDate).hour;
}

/** HH:mm en Honduras (24 h) para comparar con horario de cancha. */
export function getTimeHMInHN(isoOrDate: string | Date): string {
  const { hour, minute } = getPartesHN(isoOrDate);
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function formatFechaHoraDisplay(iso: string): { fecha: string; hora: string } {
  const date = new Date(iso);
  return {
    fecha: date.toLocaleDateString('es-HN', {
      timeZone: APP_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    hora: date.toLocaleTimeString('es-HN', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };
}

/** Formato 12 h desde un Date (componentes locales del Date; usar tras setHours local). */
export function formatHora12HN(isoOrDate: string | Date): string {
  const { hour, minute } = getPartesHN(isoOrDate);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const horas12 = hour % 12 || 12;
  return `${pad2(horas12)}:${pad2(minute)} ${ampm}`;
}

export function formatHora12FromDate(fecha: Date): string {
  const { hour, minute } = {
    hour: fecha.getHours(),
    minute: fecha.getMinutes(),
  };
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const horas12 = hour % 12 || 12;
  return `${pad2(horas12)}:${pad2(minute)} ${ampm}`;
}

/** Convierte un Date (p. ej. del picker) al ISO UTC según reloj de Honduras. */
export function dateToUtcIsoHN(date: Date): string {
  const p = getPartesHN(date);
  return localHNToUtcIso(`${p.year}-${pad2(p.month)}-${pad2(p.day)}`, p.hour, p.minute);
}
