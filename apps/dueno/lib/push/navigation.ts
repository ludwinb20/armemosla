import { router } from 'expo-router';

type NotificationData = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Navega según data.type al tocar una push notification.
 */
export function navigateFromPushNotification(data: NotificationData | undefined): void {
  if (!data) return;

  const type = asString(data.type);
  if (!type) return;

  if (type === 'pago_pendiente' || type === 'solicitud_reembolso_nueva' || type === 'revision_pendiente_digest') {
    router.push('/(tabs)/revision-pagos');
    return;
  }

  if (
    type.startsWith('pago_') ||
    type.startsWith('factura_') ||
    type.startsWith('reembolso_') ||
    type === 'complejos_ocultos'
  ) {
    router.push('/(tabs)/pagos');
    return;
  }

  if (type === 'reserva_nueva' || type === 'reserva_cancelada') {
    router.push('/(tabs)/reservas');
    return;
  }

  if (
    type === 'reserva_cancelada_admin' ||
    type === 'recordatorio_reserva' ||
    type === 'recordatorio_partido'
  ) {
    router.push('/(tabs)/mis-reservas');
    return;
  }

  const solicitudId = asString(data.solicitud_id);
  if (
    solicitudId &&
    (type.startsWith('solicitud_') || type === 'mensaje_solicitud')
  ) {
    router.push({ pathname: '/solicitud-chat', params: { solicitudId } });
    return;
  }

  if (type.startsWith('reto_directo_')) {
    router.push({ pathname: '/(tabs)/mis-reservas', params: { seccion: 'solicitudes' } });
    return;
  }

  if (type === 'match_encontrado') {
    router.push('/(tabs)/armemosla/buscar-rival');
    return;
  }

  if (type.startsWith('logro_') || type.startsWith('recompensa_')) {
    router.push('/(tabs)/logros');
  }
}
