import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/paypal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
  } = await userClient.auth.getUser();

  if (!user) {
    return jsonResponse({ ok: false, error: 'Sesión inválida' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('metodos_pago_paypal')
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

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const metodoId = url.searchParams.get('metodo_id');
    if (!metodoId) {
      return jsonResponse({ ok: false, error: 'metodo_id requerido' }, 400);
    }

    const { error } = await admin
      .from('metodos_pago_paypal')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', metodoId)
      .eq('admin_id', user.id);

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    return jsonResponse({ ok: true });
  }

  if (req.method === 'PATCH') {
    const body = await req.json();
    const metodoId = body?.metodo_id as string | undefined;
    if (!metodoId) {
      return jsonResponse({ ok: false, error: 'metodo_id requerido' }, 400);
    }

    await admin
      .from('metodos_pago_paypal')
      .update({ es_predeterminado: false })
      .eq('admin_id', user.id);

    const { error } = await admin
      .from('metodos_pago_paypal')
      .update({ es_predeterminado: true, updated_at: new Date().toISOString() })
      .eq('id', metodoId)
      .eq('admin_id', user.id);

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: 'Método no permitido' }, 405);
});
