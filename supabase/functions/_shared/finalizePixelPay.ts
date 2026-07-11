import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { extractSaleIds } from './pixelpay.ts';
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

export async function finalizePixelPaySale(
  supabase: SupabaseClient,
  pagoId: string,
  saleResponse: Record<string, unknown>
): Promise<{ ok: true; factura_id: string } | { ok: false; error: string }> {
  const { transaction_id, payment_uuid } = extractSaleIds(saleResponse);

  const { data: pago, error: pagoError } = await supabase
    .from('pagos_pixelpay')
    .select('id, factura_id, admin_id, estado')
    .eq('id', pagoId)
    .single();

  if (pagoError || !pago) {
    return { ok: false, error: 'Registro de pago no encontrado' };
  }

  if (pago.estado === 'approved') {
    return { ok: true, factura_id: pago.factura_id };
  }

  const { error: updatePagoError } = await supabase
    .from('pagos_pixelpay')
    .update({
      estado: 'approved',
      pixelpay_transaction_id: transaction_id,
      pixelpay_payment_uuid: payment_uuid,
      raw_response: saleResponse,
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
      pixelpay_transaction_id: transaction_id,
      pixelpay_payment_uuid: payment_uuid,
    })
    .eq('id', pago.factura_id);

  await dispatchNotification(supabase, 'pago_tarjeta_ok', { factura_id: pago.factura_id });
  await dispatchNotification(supabase, 'factura_pagada', { factura_id: pago.factura_id });

  return { ok: true, factura_id: pago.factura_id };
}
