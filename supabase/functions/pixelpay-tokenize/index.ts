import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  corsHeaders,
  jsonResponse,
  pixelPayTokenizeCard,
  extractTokenData,
  buildBillingFromProfile,
} from '../_shared/pixelpay.ts';
import { getServiceSupabase } from '../_shared/finalizePixelPay.ts';

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

    const admin = getServiceSupabase();
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .maybeSingle();

    const billing = buildBillingFromProfile(profile, user.email);
    const cardInput = {
      number: cardNumber,
      cvv2: cardCvv,
      expire_month: expireMonth,
      expire_year: expireYear,
      cardholder: cardHolder,
    };

    const tokenRes = await pixelPayTokenizeCard({ card: cardInput, billing });
    const tokenData = extractTokenData(tokenRes);

    if (!tokenData.token) {
      return jsonResponse({ ok: false, error: 'PixelPay no devolvió token de tarjeta' }, 502);
    }

    await admin.from('metodos_pago_pixelpay').update({ es_predeterminado: false }).eq('admin_id', user.id);

    const { data: metodo, error: upsertError } = await admin
      .from('metodos_pago_pixelpay')
      .upsert(
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
      )
      .select('id, marca, ultimos_digitos, exp_mes, exp_anio, es_predeterminado, created_at')
      .single();

    if (upsertError) {
      console.error('[pixelpay-tokenize] upsert', upsertError);
      return jsonResponse({ ok: false, error: 'Tarjeta tokenizada pero no se pudo guardar' }, 500);
    }

    return jsonResponse({ ok: true, metodo });
  } catch (error) {
    console.error('[pixelpay-tokenize]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
