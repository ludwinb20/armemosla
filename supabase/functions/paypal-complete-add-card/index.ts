import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse, createPaymentTokenFromSetup } from '../_shared/paypal.ts';
import { upsertMetodoPagoVault } from '../_shared/vaultPaymentMethod.ts';

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
    const setupTokenId = body?.setup_token_id as string | undefined;
    if (!setupTokenId) {
      console.error('[paypal-complete-add-card] falta setup_token_id');
      return jsonResponse({ ok: false, error: 'setup_token_id requerido' }, 400);
    }

    console.log('[paypal-complete-add-card] user=', user.id, 'setup_token=', setupTokenId.slice(0, 8) + '…');

    const vaultResponse = await createPaymentTokenFromSetup(setupTokenId);
    const vaultId = vaultResponse.id as string | undefined;
    if (!vaultId) {
      console.error('[paypal-complete-add-card] sin vault id', vaultResponse);
      return jsonResponse({ ok: false, error: 'PayPal no devolvió el token de la tarjeta', details: vaultResponse }, 502);
    }

    console.log('[paypal-complete-add-card] vault_id=', vaultId);

    const paymentSource = vaultResponse.payment_source as Record<string, unknown> | undefined;
    const card = paymentSource?.card as
      | { brand?: string; last_digits?: string; expiry?: string }
      | undefined;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await upsertMetodoPagoVault(admin, user.id, vaultId, card);

    return jsonResponse({ ok: true, vault_id: vaultId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[paypal-complete-add-card] ERROR', message, error);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
