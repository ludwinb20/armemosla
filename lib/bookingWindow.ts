/** Inicio del día local actual (00:00:00.000). */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
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
