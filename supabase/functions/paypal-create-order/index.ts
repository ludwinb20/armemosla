import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  corsHeaders,
  jsonResponse,
  createPayPalOrder,
  extractApprovalUrl,
  getPayPalCurrency,
  getPayPalReturnBaseUrl,
  getPayPalCancelBaseUrl,
} from '../_shared/paypal.ts';

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    if (!facturaId) {
      return jsonResponse({ ok: false, error: 'factura_id requerido' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    if (factura.estado_pago === 'pagado' || factura.fecha_pago) {
      return jsonResponse({ ok: false, error: 'Esta factura ya está pagada' }, 409);
    }

    const comisionBase = Number(factura.comision_neta ?? factura.comision ?? 0);
    const mora = Number(factura.monto_mora ?? 0);
    const total = comisionBase + mora;

    if (total <= 0) {
      return jsonResponse({ ok: false, error: 'No hay monto pendiente en esta factura' }, 422);
    }

    const currency = getPayPalCurrency();
    const returnBase = getPayPalReturnBaseUrl();
    const cancelBase = getPayPalCancelBaseUrl();

    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const descripcion = `Armemosla · Factura ${meses[factura.mes - 1]} ${factura.año}`;

    const order = await createPayPalOrder({
      facturaId,
      amount: total.toFixed(2),
      currency,
      description: descripcion,
      returnUrl: `${returnBase}?factura_id=${facturaId}`,
      cancelUrl: `${cancelBase}?factura_id=${facturaId}`,
    });

    const approvalUrl = extractApprovalUrl(order);
    if (!approvalUrl) {
      return jsonResponse({ ok: false, error: 'PayPal no devolvió URL de aprobación' }, 502);
    }

    const { error: insertError } = await admin.from('pagos_paypal').insert({
      factura_id: facturaId,
      admin_id: user.id,
      paypal_order_id: order.id,
      monto: total,
      moneda: currency,
      estado: 'created',
      approval_url: approvalUrl,
      raw_create_response: order,
    });

    if (insertError) {
      console.error('[paypal-create-order] insert', insertError);
      return jsonResponse({ ok: false, error: 'No se pudo registrar el intento de pago' }, 500);
    }

    return jsonResponse({
      ok: true,
      paypal_order_id: order.id,
      approval_url: approvalUrl,
      monto: total,
      moneda: currency,
      message: 'Checkout listo. Completá el pago con tarjeta en la pantalla segura.',
    });
  } catch (error) {
    console.error('[paypal-create-order]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
