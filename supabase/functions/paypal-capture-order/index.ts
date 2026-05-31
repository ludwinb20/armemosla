import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/paypal.ts';
import { captureAndFinalize, getServiceSupabase } from '../_shared/finalizePayPal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ ok: false, error: 'No autenticado' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Sesión inválida' }, 401);
    }

    const body = await req.json();
    const paypalOrderId = body?.paypal_order_id as string | undefined;
    const facturaId = body?.factura_id as string | undefined;

    if (!paypalOrderId && !facturaId) {
      return jsonResponse({ ok: false, error: 'paypal_order_id o factura_id requerido' }, 400);
    }

    const admin = getServiceSupabase();

    let orderId = paypalOrderId;
    if (!orderId && facturaId) {
      const { data: pago } = await admin
        .from('pagos_paypal')
        .select('paypal_order_id, estado')
        .eq('factura_id', facturaId)
        .eq('admin_id', user.id)
        .neq('estado', 'captured')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pago?.paypal_order_id) {
        return jsonResponse({ ok: false, error: 'No hay pago PayPal pendiente para esta factura' }, 404);
      }
      orderId = pago.paypal_order_id;
    }

    const { data: pagoRecord } = await admin
      .from('pagos_paypal')
      .select('admin_id, estado, factura_id')
      .eq('paypal_order_id', orderId!)
      .single();

    if (!pagoRecord || pagoRecord.admin_id !== user.id) {
      return jsonResponse({ ok: false, error: 'Pago no autorizado' }, 403);
    }

    if (pagoRecord.estado === 'captured') {
      return jsonResponse({ ok: true, factura_id: pagoRecord.factura_id, already_captured: true });
    }

    const result = await captureAndFinalize(admin, orderId!);
    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 422);
    }

    return jsonResponse({ ok: true, factura_id: result.factura_id });
  } catch (error) {
    console.error('[paypal-capture-order]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
