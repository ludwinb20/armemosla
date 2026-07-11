export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getPayPalApiBase(): string {
  const mode = Deno.env.get('PAYPAL_MODE') ?? 'sandbox';
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function getPayPalCurrency(): string {
  return Deno.env.get('PAYPAL_CURRENCY') ?? 'USD';
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET no configurados');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal OAuth error: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export type PayPalLink = { href: string; rel: string; method?: string };

export type PayPalOrder = {
  id: string;
  status: string;
  links?: PayPalLink[];
};

export async function createPayPalOrder(params: {
  facturaId: string;
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayPalOrder> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.facturaId,
          description: params.description,
          amount: {
            currency_code: params.currency,
            value: params.amount,
          },
        },
      ],
      application_context: {
        brand_name: 'Armemosla',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.message ?? data?.details?.[0]?.description ?? JSON.stringify(data);
    throw new Error(`PayPal create order: ${message}`);
  }

  return data as PayPalOrder;
}

export async function capturePayPalOrder(orderId: string): Promise<Record<string, unknown>> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.message ?? data?.details?.[0]?.description ?? JSON.stringify(data);
    throw new Error(`PayPal capture order: ${message}`);
  }

  return data as Record<string, unknown>;
}

export function extractApprovalUrl(order: PayPalOrder): string | null {
  const links = order.links ?? [];
  const approve =
    links.find((l) => l.rel === 'payer-action') ??
    links.find((l) => l.rel === 'approve');
  return approve?.href ?? null;
}

export function extractCaptureId(captureResponse: Record<string, unknown>): string | null {
  const units = captureResponse.purchase_units as Array<Record<string, unknown>> | undefined;
  const payments = units?.[0]?.payments as Record<string, unknown> | undefined;
  const captures = payments?.captures as Array<Record<string, unknown>> | undefined;
  const id = captures?.[0]?.id;
  return typeof id === 'string' ? id : null;
}

/** PayPal merchant_customer_id: máx. 22 chars, solo [0-9a-zA-Z_-]. */
export function toPayPalMerchantCustomerId(supabaseUserId: string): string {
  return supabaseUserId.replace(/-/g, '').slice(0, 22);
}

export function formatPayPalError(data: unknown, prefix: string): string {
  const d = data as {
    message?: string;
    name?: string;
    debug_id?: string;
    details?: Array<{ description?: string; issue?: string; field?: string }>;
  };
  const detail = d?.details?.[0];
  const field = detail?.field ? ` (${detail.field})` : '';
  const issue = detail?.issue ?? '';
  const raw = detail?.description ?? detail?.issue ?? d?.message ?? JSON.stringify(data);
  const debugId = d?.debug_id ? ` [debug_id: ${d.debug_id}]` : '';

  const vaultNotEnabled =
    d?.name === 'NOT_AUTHORIZED' ||
    issue === 'PERMISSION_DENIED' ||
    issue.includes('NOT_ENABLED') ||
    issue.includes('NOT_ONBOARDED') ||
    raw.toLowerCase().includes('not onboarded') ||
    raw.toLowerCase().includes('vaulting is not enabled');

  if (vaultNotEnabled) {
    return (
      `${prefix}: tu app PayPal no tiene Vault + tarjetas (ACDC) activos. ` +
      `Developer Dashboard → tu app REST → Accept payments → Advanced Credit and Debit Card + Vault (Advanced options). ` +
      `Detalle PayPal: ${raw}${debugId}`
    );
  }

  return `${prefix}${field}: ${raw}${debugId}`;
}

/** Serializa error PayPal para respuesta JSON de edge functions. */
export function paypalErrorPayload(data: unknown, prefix: string): {
  error: string;
  paypal_name?: string;
  paypal_details?: unknown;
  paypal_debug_id?: string;
} {
  const d = data as {
    name?: string;
    details?: unknown;
    debug_id?: string;
  };
  return {
    error: formatPayPalError(data, prefix),
    paypal_name: d?.name,
    paypal_details: d?.details,
    paypal_debug_id: d?.debug_id,
  };
}

export function getPayPalReturnBaseUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/paypal-return-redirect`;
  }
  return Deno.env.get('PAYPAL_RETURN_URL') ?? 'https://armemosla.app/pagos/paypal/return';
}

export function getPayPalCancelBaseUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/paypal-cancel-redirect`;
  }
  return Deno.env.get('PAYPAL_CANCEL_URL') ?? 'https://armemosla.app/pagos/paypal/cancel';
}

export async function createPayPalOrderWithVaultToken(params: {
  facturaId: string;
  amount: string;
  currency: string;
  description: string;
  vaultTokenId: string;
}): Promise<PayPalOrder> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      payment_source: {
        token: {
          id: params.vaultTokenId,
          type: 'PAYMENT_METHOD_TOKEN',
        },
      },
      purchase_units: [
        {
          reference_id: params.facturaId,
          description: params.description,
          amount: {
            currency_code: params.currency,
            value: params.amount,
          },
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.message ?? data?.details?.[0]?.description ?? JSON.stringify(data);
    throw new Error(`PayPal order con método guardado: ${message}`);
  }

  return data as PayPalOrder;
}

export type PayPalSetupToken = {
  id: string;
  status?: string;
  links?: PayPalLink[];
  payment_source?: Record<string, unknown>;
};

function buildSetupTokenBody(params: {
  customerId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  return {
    customer: {
      merchant_customer_id: toPayPalMerchantCustomerId(params.customerId),
    },
    payment_source: {
      card: {
        verification_method: 'SCA_WHEN_REQUIRED',
        experience_context: {
          brand_name: 'Armemosla',
          locale: 'en-US',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          vault_instruction: 'ON_CREATE_PAYMENT_TOKENS',
        },
      },
    },
  };
}

/** Prueba setup token y devuelve respuesta cruda (para diagnóstico). */
export async function probePayPalSetupToken(params: {
  customerId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalApiBase()}/v3/vault/setup-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify(buildSetupTokenBody(params)),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export async function createPayPalSetupToken(params: {
  customerId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayPalSetupToken> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalApiBase()}/v3/vault/setup-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify(buildSetupTokenBody(params)),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('[PayPal API] POST /v3/vault/setup-tokens', {
      status: res.status,
      customer: toPayPalMerchantCustomerId(params.customerId),
      returnUrl: params.returnUrl,
      cancelUrl: params.cancelUrl,
      response: data,
    });
    throw new Error(formatPayPalError(data, 'PayPal setup token'));
  }

  return data as PayPalSetupToken;
}

export async function createPaymentTokenFromSetup(setupTokenId: string): Promise<Record<string, unknown>> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalApiBase()}/v3/vault/payment-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      payment_source: {
        token: {
          id: setupTokenId,
          type: 'SETUP_TOKEN',
        },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('[PayPal API] POST /v3/vault/payment-tokens', {
      status: res.status,
      setupTokenId,
      response: data,
    });
    throw new Error(formatPayPalError(data, 'PayPal guardar tarjeta'));
  }

  return data as Record<string, unknown>;
}

export function extractSetupApprovalUrl(setup: PayPalSetupToken): string | null {
  const links = setup.links ?? [];
  const approve =
    links.find((l) => l.rel === 'approve') ??
    links.find((l) => l.rel === 'payer-action');
  return approve?.href ?? null;
}

export async function getPayPalPaymentToken(vaultId: string): Promise<Record<string, unknown>> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalApiBase()}/v3/vault/payment-tokens/${vaultId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? 'No se pudo obtener el token de pago');
  }
  return data as Record<string, unknown>;
}
