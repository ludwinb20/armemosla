import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  corsHeaders,
  jsonResponse,
  createPayPalSetupToken,
  extractSetupApprovalUrl,
  getPayPalReturnBaseUrl,
  getPayPalCancelBaseUrl,
  paypalErrorPayload,
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
    const returnUrl = `${returnBase}?modo=tarjeta`;
    const cancelUrl = `${cancelBase}?modo=tarjeta`;

    console.log('[paypal-add-card] user=', user.id, 'returnUrl=', returnUrl);

    const setup = await createPayPalSetupToken({
      customerId: user.id,
      returnUrl,
      cancelUrl,
    });
    const approvalUrl = extractSetupApprovalUrl(setup);

    console.log('[paypal-add-card] setup', {
      id: setup.id,
      status: setup.status,
      hasApprovalUrl: !!approvalUrl,
      links: setup.links?.map((l) => l.rel),
    });

    if (!approvalUrl) {
      console.error('[paypal-add-card] sin URL de aprobación', setup);
      return jsonResponse(
        { ok: false, error: 'PayPal no devolvió URL para agregar tarjeta', details: { status: setup.status, links: setup.links } },
        502
      );
    }

    return jsonResponse({
      ok: true,
      setup_token_id: setup.id,
      approval_url: approvalUrl,
      cancel_url: getPayPalCancelBaseUrl(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[paypal-add-card] ERROR', message, error);
    const mode = Deno.env.get('PAYPAL_MODE') ?? 'sandbox';
    const hasCreds = !!(Deno.env.get('PAYPAL_CLIENT_ID') && Deno.env.get('PAYPAL_CLIENT_SECRET'));
    return jsonResponse(
      {
        ok: false,
        ...paypalErrorPayload({ message }, 'PayPal setup token'),
        error: message,
        details: {
          paypal_mode: mode,
          paypal_credentials_configured: hasCreds,
          hint: 'Ejecutá paypal-diagnose o revisá docs/PAYPAL_VAULT_SETUP.md',
        },
      },
      500
    );
  }
});
