export const APP_TIMEZONE = 'America/Tegucigalpa';
export const HN_UTC_OFFSET = '-06:00';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export type FechaHoraPartesHN = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

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

export function localHNToUtcIso(dateYmd: string, hour: number, minute: number): string {
  const [y, m, d] = dateYmd.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) throw new Error('Fecha inválida');
  const local = `${y}-${pad2(m)}-${pad2(d)}T${pad2(hour)}:${pad2(minute)}:00${HN_UTC_OFFSET}`;
  return new Date(local).toISOString();
}

export function isoToDateAndTimeInputs(iso: string): { date: string; time: string } {
  const p = getPartesHN(iso);
  return {
    date: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
  };
}

export function formatReservaFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-HN', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
