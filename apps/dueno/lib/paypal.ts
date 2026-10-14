import Constants from 'expo-constants';
import { supabase } from './supabase';

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export interface MetodoPagoPayPal {
  id: string;
  marca: string | null;
  ultimos_digitos: string | null;
  exp_mes: number | null;
  exp_anio: number | null;
  es_predeterminado: boolean;
  created_at: string;
}

export interface PayPalCreateOrderResponse {
  ok: boolean;
  paypal_order_id?: string;
  approval_url?: string;
  monto?: number;
  moneda?: string;
  message?: string;
  error?: string;
}

export interface PayPalCaptureOrderResponse {
  ok: boolean;
  factura_id?: string;
  already_captured?: boolean;
  error?: string;
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error('Sesión no válida. Iniciá sesión nuevamente.');
  }

  return session.access_token;
}

async function callFunction<T>(
  path: string,
  init?: RequestInit,
  logTag?: string
): Promise<T> {
  const tag = logTag ?? path;
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    apikey: supabaseAnonKey,
  };
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${supabaseUrl}/functions/v1/${path}`;
  console.log(`[PayPal:${tag}] → ${init?.method ?? 'GET'} ${path}`);

  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  let data: T & { ok?: boolean; error?: string; details?: unknown; debug?: unknown };
  const rawText = await res.text();
  try {
    data = JSON.parse(rawText) as T & { ok?: boolean; error?: string; details?: unknown; debug?: unknown };
  } catch {
    console.error(`[PayPal:${tag}] respuesta no JSON`, {
      status: res.status,
      body: rawText.slice(0, 500),
    });
    if (res.status === 404) {
      throw new Error(`Servicio de pagos no disponible (${path}). ¿Está desplegado en Supabase?`);
    }
    throw new Error(`Error ${res.status} en el servidor de pagos`);
  }

  if (!res.ok || data.ok === false) {
    console.error(`[PayPal:${tag}] error`, {
      status: res.status,
      error: data.error,
      details: data.details,
      debug: data.debug,
      body: data,
    });
    throw new Error(data.error ?? 'Error en el servidor de pagos');
  }

  console.log(`[PayPal:${tag}] OK`);
  return data;
}

/** Crea checkout PayPal (tarjeta / cuenta PayPal en página segura de PayPal). */
export async function solicitarPagoPayPal(facturaId: string): Promise<PayPalCreateOrderResponse> {
  return callFunction<PayPalCreateOrderResponse>('paypal-create-order', {
    method: 'POST',
    body: JSON.stringify({ factura_id: facturaId }),
  });
}

/** Confirma captura tras volver del checkout (respaldo del webhook). */
export async function confirmarPagoPayPal(params: {
  facturaId?: string;
  paypalOrderId?: string;
}): Promise<PayPalCaptureOrderResponse> {
  return callFunction<PayPalCaptureOrderResponse>('paypal-capture-order', {
    method: 'POST',
    body: JSON.stringify({
      factura_id: params.facturaId,
      paypal_order_id: params.paypalOrderId,
    }),
  });
}

/** Paga con tarjeta guardada — todo en servidor, sin WebView. */
export async function pagarConMetodoGuardado(
  facturaId: string,
  metodoId: string
): Promise<PayPalCaptureOrderResponse> {
  return callFunction<PayPalCaptureOrderResponse>('paypal-pay-saved', {
    method: 'POST',
    body: JSON.stringify({ factura_id: facturaId, metodo_id: metodoId }),
  });
}

/** Confirma tarjeta guardada tras volver del checkout PayPal (setup token → vault). */
export async function confirmarTarjetaAgregada(setupTokenId?: string): Promise<void> {
  if (!setupTokenId) {
    console.error('[PayPal:add-card:confirm] sin setup token en URL de retorno');
    throw new Error('PayPal no devolvió el token de confirmación');
  }
  console.log('[PayPal:add-card:confirm] setup_token_id=', setupTokenId.slice(0, 8) + '…');
  await callFunction(
    'paypal-complete-add-card',
    {
      method: 'POST',
      body: JSON.stringify({ setup_token_id: setupTokenId }),
    },
    'add-card:confirm'
  );
}

export async function diagnosticarPayPal(): Promise<{
  ok: boolean;
  vault_disponible: boolean;
  recomendaciones: string[];
  diagnose?: Record<string, unknown>;
}> {
  return callFunction('paypal-diagnose', { method: 'GET' }, 'diagnose');
}

export async function iniciarAgregarTarjeta(): Promise<{
  ok: boolean;
  approval_url: string;
  setup_token_id: string;
}> {
  console.log('[PayPal:add-card] solicitando setup token…');
  const res = await callFunction<{
    ok: boolean;
    approval_url: string;
    setup_token_id: string;
  }>('paypal-add-card', { method: 'POST', body: '{}' }, 'add-card:start');
  console.log('[PayPal:add-card] approval_url recibida', {
    setup_token_id: res.setup_token_id?.slice(0, 8) + '…',
    approval_url: res.approval_url?.slice(0, 60) + '…',
  });
  return res;
}

export async function listarMetodosPago(): Promise<MetodoPagoPayPal[]> {
  const data = await callFunction<{ ok: boolean; metodos: MetodoPagoPayPal[] }>(
    'paypal-payment-methods',
    { method: 'GET' }
  );
  return data.metodos ?? [];
}

export async function eliminarMetodoPago(metodoId: string): Promise<void> {
  await callFunction(`paypal-payment-methods?metodo_id=${encodeURIComponent(metodoId)}`, {
    method: 'DELETE',
  });
}

export async function marcarMetodoPredeterminado(metodoId: string): Promise<void> {
  await callFunction('paypal-payment-methods', {
    method: 'PATCH',
    body: JSON.stringify({ metodo_id: metodoId }),
  });
}

export async function obtenerPagoPayPalPendiente(facturaId: string) {
  const { data, error } = await supabase
    .from('pagos_paypal')
    .select('paypal_order_id, approval_url, estado, monto, moneda, created_at')
    .eq('factura_id', facturaId)
    .neq('estado', 'captured')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function etiquetaMetodoPago(m: MetodoPagoPayPal): string {
  const marca = m.marca ?? 'Tarjeta';
  const digitos = m.ultimos_digitos ? ` ···· ${m.ultimos_digitos}` : '';
  return `${marca}${digitos}`;
}
