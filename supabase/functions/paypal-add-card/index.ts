import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  corsHeaders,
  jsonResponse,
  createPayPalSetupToken,
  extractSetupApprovalUrl,
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

    const returnBase = getPayPalReturnBaseUrl();
    const cancelBase = getPayPalCancelBaseUrl();

    const setup = await createPayPalSetupToken({
      customerId: user.id,
      returnUrl: `${returnBase}?modo=tarjeta`,
      cancelUrl: `${cancelBase}?modo=tarjeta`,
    });
    const approvalUrl = extractSetupApprovalUrl(setup);

    if (!approvalUrl) {
      return jsonResponse({ ok: false, error: 'PayPal no devolvió URL para agregar tarjeta' }, 502);
    }

    return jsonResponse({
      ok: true,
      setup_token_id: setup.id,
      approval_url: approvalUrl,
      cancel_url: getPayPalCancelBaseUrl(),
    });
  } catch (error) {
    console.error('[paypal-add-card]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
