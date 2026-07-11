import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  capturePayPalOrder,
  extractCaptureId,
} from './paypal.ts';
import { dispatchNotification } from './notificationDispatch.ts';

export function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltantes');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function finalizePayPalCapture(
  supabase: SupabaseClient,
  paypalOrderId: string,
  captureResponse: Record<string, unknown>
): Promise<{ ok: true; factura_id: string } | { ok: false; error: string }> {
  const captureId = extractCaptureId(captureResponse);
  const status = captureResponse.status as string | undefined;

  if (status !== 'COMPLETED') {
    return { ok: false, error: `Orden no completada: ${status ?? 'desconocido'}` };
  }

  const { data: pago, error: pagoError } = await supabase
    .from('pagos_paypal')
    .select('id, factura_id, admin_id, estado')
    .eq('paypal_order_id', paypalOrderId)
    .single();

  if (pagoError || !pago) {
    return { ok: false, error: 'Pago PayPal no encontrado en base de datos' };
  }

  if (pago.estado === 'captured') {
    return { ok: true, factura_id: pago.factura_id };
  }

  const { error: updatePagoError } = await supabase
    .from('pagos_paypal')
    .update({
      estado: 'captured',
      paypal_capture_id: captureId,
      raw_capture_response: captureResponse,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pago.id);

  if (updatePagoError) {
    return { ok: false, error: updatePagoError.message };
  }

  const { error: rpcError } = await supabase.rpc('marcar_factura_pagada_service', {
    p_factura_id: pago.factura_id,
  });

  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }

  await supabase
    .from('facturas_mensuales')
    .update({
      paypal_order_id: paypalOrderId,
      paypal_capture_id: captureId,
    })
    .eq('id', pago.factura_id);

  await dispatchNotification(supabase, 'pago_tarjeta_ok', { factura_id: pago.factura_id });
  await dispatchNotification(supabase, 'factura_pagada', { factura_id: pago.factura_id });

  return { ok: true, factura_id: pago.factura_id };
}

export async function captureAndFinalize(
  supabase: SupabaseClient,
  paypalOrderId: string
): Promise<{ ok: true; factura_id: string } | { ok: false; error: string }> {
  const captureResponse = await capturePayPalOrder(paypalOrderId);
  return finalizePayPalCapture(supabase, paypalOrderId, captureResponse);
}
