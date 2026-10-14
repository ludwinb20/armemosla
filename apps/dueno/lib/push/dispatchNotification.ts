import { supabase } from '../supabase';

export type PushNotificationType =
  | 'pago_pendiente'
  | 'solicitud_reembolso_nueva'
  | 'pago_confirmado'
  | 'pago_rechazado'
  | 'factura_pagada'
  | 'reembolso_aprobado'
  | 'reembolso_rechazado'
  | 'reembolso_directo'
  | 'pago_tarjeta_ok'
  | 'reserva_nueva'
  | 'reserva_cancelada'
  | 'reserva_cancelada_admin'
  | 'solicitud_partido_nueva'
  | 'solicitud_aceptada'
  | 'solicitud_rechazada'
  | 'mensaje_solicitud'
  | 'reto_directo_nuevo'
  | 'reto_directo_respuesta'
  | 'match_encontrado';

export type PushNotificationPayload = Record<string, string>;

/**
 * Encola una notificación push vía edge function (fire-and-forget).
 */
export function dispatchNotification(
  type: PushNotificationType,
  payload: PushNotificationPayload = {}
): void {
  void supabase.functions
    .invoke('dispatch-notification', {
      body: { type, payload },
    })
    .then(({ error }) => {
      if (error) {
        console.warn(`⚠️ [dispatchNotification:${type}]`, error.message);
      }
    })
    .catch((error: unknown) => {
      console.warn(
        `⚠️ [dispatchNotification:${type}]`,
        error instanceof Error ? error.message : error
      );
    });
}
