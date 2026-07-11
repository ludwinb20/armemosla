import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  corsHeaders,
  jsonResponse,
  getPixelPayCurrency,
  buildPixelPayOrder,
  buildBillingFromProfile,
  pixelPaySaleWithCard,
  pixelPaySaleWithToken,
  pixelPayTokenizeCard,
  extractTokenData,
} from '../_shared/pixelpay.ts';
import { loadFacturaParaPago } from '../_shared/facturaPago.ts';
import { getServiceSupabase, finalizePixelPaySale } from '../_shared/finalizePixelPay.ts';

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

    if (!facturaId) {
      return jsonResponse({ ok: false, error: 'factura_id requerido' }, 400);
    }

    const admin = getServiceSupabase();
    const loaded = await loadFacturaParaPago(admin, facturaId, user.id);
    if ('error' in loaded) {
      return jsonResponse({ ok: false, error: loaded.error }, loaded.status);
    }

    const { factura, total, descripcion } = loaded;
    const currency = getPixelPayCurrency();

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .maybeSingle();

    const billing = buildBillingFromProfile(profile, user.email);
    const orderId = factura.id.replace(/-/g, '').slice(0, 32);
    const order = buildPixelPayOrder({
      orderId,
      currency,
      total,
      descripcion,
      customerName: billing.customer_name,
      customerEmail: billing.customer_email,
    });

    const { data: pagoRow, error: insertError } = await admin
      .from('pagos_pixelpay')
      .insert({
        factura_id: factura.id,
        admin_id: user.id,
        monto: total,
        moneda: currency,
        estado: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !pagoRow) {
      console.error('[pixelpay-charge] insert', insertError);
      return jsonResponse({ ok: false, error: 'No se pudo registrar el intento de pago' }, 500);
    }

    try {
      let saleResponse: Record<string, unknown>;

      if (metodoId) {
        const { data: metodo, error: metodoError } = await admin
          .from('metodos_pago_pixelpay')
          .select('pixelpay_token')
          .eq('id', metodoId)
          .eq('admin_id', user.id)
          .eq('activo', true)
          .single();

        if (metodoError || !metodo) {
          return jsonResponse({ ok: false, error: 'Tarjeta guardada no encontrada' }, 404);
        }

        saleResponse = await pixelPaySaleWithToken({ order, token: metodo.pixelpay_token });
      } else {
        const cardNumber = String(body?.card_number ?? '').replace(/\s/g, '');
        const cardHolder = String(body?.card_holder ?? '').trim();
        const cardCvv = String(body?.card_cvv ?? '').trim();
        const expireMonth = Number(body?.expire_month);
        const expireYear = Number(body?.expire_year);

        if (!cardNumber || !cardHolder || !cardCvv || !expireMonth || !expireYear) {
          return jsonResponse(
            { ok: false, error: 'Completá número, titular, vencimiento y CVV de la tarjeta' },
            400
          );
        }

        const cardInput = {
          number: cardNumber,
          cvv2: cardCvv,
          expire_month: expireMonth,
          expire_year: expireYear,
          cardholder: cardHolder,
        };

        saleResponse = await pixelPaySaleWithCard({ order, billing, card: cardInput });

        if (body?.guardar_tarjeta === true) {
          try {
            const tokenRes = await pixelPayTokenizeCard({ card: cardInput, billing });
            const tokenData = extractTokenData(tokenRes);
            if (tokenData.token) {
              await admin.from('metodos_pago_pixelpay').update({ es_predeterminado: false }).eq('admin_id', user.id);
              await admin.from('metodos_pago_pixelpay').upsert(
                {
                  admin_id: user.id,
                  pixelpay_token: tokenData.token,
                  marca: tokenData.marca,
                  ultimos_digitos: tokenData.ultimos_digitos,
                  exp_mes: expireMonth,
                  exp_anio: expireYear,
                  es_predeterminado: true,
                  activo: true,
                },
                { onConflict: 'admin_id,pixelpay_token' }
              );
            }
          } catch (tokenErr) {
            console.warn('[pixelpay-charge] pago OK pero falló guardar tarjeta', tokenErr);
          }
        }
      }

      const result = await finalizePixelPaySale(admin, pagoRow.id, saleResponse);
      if (!result.ok) {
        await admin
          .from('pagos_pixelpay')
          .update({ estado: 'failed', error_message: result.error })
          .eq('id', pagoRow.id);
        return jsonResponse({ ok: false, error: result.error }, 422);
      }

      return jsonResponse({ ok: true, factura_id: result.factura_id });
    } catch (saleErr) {
      const message = saleErr instanceof Error ? saleErr.message : 'Pago rechazado';
      await admin
        .from('pagos_pixelpay')
        .update({ estado: 'failed', error_message: message })
        .eq('id', pagoRow.id);
      return jsonResponse({ ok: false, error: message }, 422);
    }
  } catch (error) {
    console.error('[pixelpay-charge]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
