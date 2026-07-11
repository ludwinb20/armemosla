import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse, pixelPayDeleteToken } from '../_shared/pixelpay.ts';
import { getServiceSupabase } from '../_shared/finalizePixelPay.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const admin = getServiceSupabase();
    const url = new URL(req.url);
    const metodoId = url.searchParams.get('metodo_id');

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('metodos_pago_pixelpay')
        .select('id, marca, ultimos_digitos, exp_mes, exp_anio, es_predeterminado, created_at')
        .eq('admin_id', user.id)
        .eq('activo', true)
        .order('es_predeterminado', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        return jsonResponse({ ok: false, error: error.message }, 500);
      }

      return jsonResponse({ ok: true, metodos: data ?? [] });
    }

    if (req.method === 'PATCH') {
      const body = await req.json();
      const id = body?.metodo_id as string | undefined;
      if (!id) {
        return jsonResponse({ ok: false, error: 'metodo_id requerido' }, 400);
      }

      await admin
        .from('metodos_pago_pixelpay')
        .update({ es_predeterminado: false })
        .eq('admin_id', user.id);

      const { error } = await admin
        .from('metodos_pago_pixelpay')
        .update({ es_predeterminado: true })
        .eq('id', id)
        .eq('admin_id', user.id);

      if (error) {
        return jsonResponse({ ok: false, error: error.message }, 500);
      }

      return jsonResponse({ ok: true });
    }

    if (req.method === 'DELETE') {
      if (!metodoId) {
        return jsonResponse({ ok: false, error: 'metodo_id requerido' }, 400);
      }

      const { data: metodo, error: fetchError } = await admin
        .from('metodos_pago_pixelpay')
        .select('pixelpay_token')
        .eq('id', metodoId)
        .eq('admin_id', user.id)
        .single();

      if (fetchError || !metodo) {
        return jsonResponse({ ok: false, error: 'Método no encontrado' }, 404);
      }

      try {
        await pixelPayDeleteToken(metodo.pixelpay_token);
      } catch (e) {
        console.warn('[pixelpay-payment-methods] delete token remoto', e);
      }

      const { error } = await admin
        .from('metodos_pago_pixelpay')
        .update({ activo: false, es_predeterminado: false })
        .eq('id', metodoId)
        .eq('admin_id', user.id);

      if (error) {
        return jsonResponse({ ok: false, error: error.message }, 500);
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Método no permitido' }, 405);
  } catch (error) {
    console.error('[pixelpay-payment-methods]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
