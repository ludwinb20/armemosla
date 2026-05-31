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
    const facturaId = body?.factura_id as string | undefined;
    const metodoId = body?.metodo_id as string | undefined;

    if (!facturaId || !metodoId) {
      return jsonResponse({ ok: false, error: 'factura_id y metodo_id requeridos' }, 400);
    }

    const admin = getServiceSupabase();
    await admin.rpc('procesar_politicas_pago_facturas');

    const { data: factura, error: facturaError } = await admin
      .from('facturas_mensuales')
      .select('*')
      .eq('id', facturaId)
      .eq('admin_id', user.id)
      .single();

    if (facturaError || !factura) {
      return jsonResponse({ ok: false, error: 'Factura no encontrada' }, 404);
    }

    if (factura.estado_pago === 'pagado') {
      return jsonResponse({ ok: false, error: 'Factura ya pagada' }, 409);
    }

    const { data: metodo, error: metodoError } = await admin
      .from('metodos_pago_paypal')
      .select('*')
      .eq('id', metodoId)
      .eq('admin_id', user.id)
      .eq('activo', true)
      .single();

    if (metodoError || !metodo) {
      return jsonResponse({ ok: false, error: 'Método de pago no encontrado' }, 404);
    }

    const comisionBase = Number(factura.comision_neta ?? factura.comision ?? 0);
    const mora = Number(factura.monto_mora ?? 0);
    const total = comisionBase + mora;

    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const descripcion = `Armemosla · Factura ${meses[factura.mes - 1]} ${factura.año}`;
    const currency = Deno.env.get('PAYPAL_CURRENCY') ?? 'USD';

    const { createPayPalOrderWithVaultToken } = await import('../_shared/paypal.ts');
    const order = await createPayPalOrderWithVaultToken({
      facturaId,
      amount: total.toFixed(2),
      currency,
      description: descripcion,
      vaultTokenId: metodo.paypal_vault_id,
    });

    await admin.from('pagos_paypal').insert({
      factura_id: facturaId,
      admin_id: user.id,
      paypal_order_id: order.id,
      monto: total,
      moneda: currency,
      estado: 'approved',
      raw_create_response: order,
    });

    const result = await captureAndFinalize(admin, order.id);
    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 422);
    }

    return jsonResponse({ ok: true, factura_id: result.factura_id });
  } catch (error) {
    console.error('[paypal-pay-saved]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
