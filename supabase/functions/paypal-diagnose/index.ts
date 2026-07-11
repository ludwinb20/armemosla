import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  corsHeaders,
  jsonResponse,
  getPayPalApiBase,
  getPayPalReturnBaseUrl,
  getPayPalCancelBaseUrl,
  getPayPalAccessToken,
  probePayPalSetupToken,
  toPayPalMerchantCustomerId,
} from '../_shared/paypal.ts';

function recomendaciones(diagnose: Record<string, unknown>): string[] {
  const tips: string[] = [];
  const oauth = diagnose.oauth as { ok?: boolean; error?: string } | undefined;
  const vault = diagnose.vault_setup_token as
    | { ok?: boolean; status?: number; body?: Record<string, unknown> }
    | undefined;

  if (!oauth?.ok) {
    tips.push('Revisá PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET y PAYPAL_MODE (sandbox/live) en Supabase Secrets.');
    tips.push('El Client ID y Secret deben ser de la misma app REST en developer.paypal.com.');
    return tips;
  }

  const name = vault?.body?.name as string | undefined;
  const details = vault?.body?.details as Array<{ issue?: string; description?: string }> | undefined;
  const issue = details?.[0]?.issue ?? '';

  if (vault?.ok) {
    tips.push('Vault responde OK. Si falla en la app, redeploy: pnpm exec supabase functions deploy paypal-add-card');
    return tips;
  }

  tips.push('Developer Dashboard (Sandbox) → Apps & Credentials → tu app → Accept payments.');
  tips.push('Activá: Advanced Credit and Debit Card Payments + Vault (Advanced options) → Save.');
  tips.push('Testing Tools → Sandbox accounts: usá cuenta Business (no Personal).');
  tips.push('Si ACDC está grisado: https://www.sandbox.paypal.com/bizsignup/entry/product/ppcp');

  if (name === 'NOT_AUTHORIZED' || issue.includes('PERMISSION')) {
    tips.push('PayPal dice NOT_AUTHORIZED: la app no tiene permiso Vault. Creá una app REST nueva o contactá soporte PayPal Developer.');
  }

  tips.push('Mientras tanto podés pagar con «Pagar con otra tarjeta» (checkout sin guardar).');

  return tips;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
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
    } = await userClient.auth.getUser();

    if (!user) {
      return jsonResponse({ ok: false, error: 'Sesión inválida' }, 401);
    }

    const mode = Deno.env.get('PAYPAL_MODE') ?? 'sandbox';
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
    const hasSecret = !!Deno.env.get('PAYPAL_CLIENT_SECRET');

    const diagnose: Record<string, unknown> = {
      paypal_mode: mode,
      paypal_api: getPayPalApiBase(),
      client_id_prefix: clientId ? `${clientId.slice(0, 8)}…` : null,
      credentials_configured: !!clientId && hasSecret,
      merchant_customer_id_sample: toPayPalMerchantCustomerId(user.id),
    };

    try {
      await getPayPalAccessToken();
      diagnose.oauth = { ok: true };
    } catch (e) {
      diagnose.oauth = { ok: false, error: e instanceof Error ? e.message : String(e) };
      return jsonResponse({
        ok: true,
        vault_disponible: false,
        diagnose,
        recomendaciones: recomendaciones(diagnose),
      });
    }

    const returnUrl = `${getPayPalReturnBaseUrl()}?modo=tarjeta`;
    const cancelUrl = `${getPayPalCancelBaseUrl()}?modo=tarjeta`;

    const probe = await probePayPalSetupToken({
      customerId: user.id,
      returnUrl,
      cancelUrl,
    });

    diagnose.vault_setup_token = {
      ok: probe.ok,
      status: probe.status,
      body: probe.body,
    };

    const vaultDisponible = probe.ok;

    return jsonResponse({
      ok: true,
      vault_disponible: vaultDisponible,
      diagnose,
      recomendaciones: recomendaciones(diagnose),
    });
  } catch (error) {
    console.error('[paypal-diagnose]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
