import Constants from 'expo-constants';
import { supabase } from './supabase';

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export interface MetodoPagoTarjeta {
  id: string;
  marca: string | null;
  ultimos_digitos: string | null;
  exp_mes: number | null;
  exp_anio: number | null;
  es_predeterminado: boolean;
  created_at: string;
}

export interface DatosTarjeta {
  card_number: string;
  card_holder: string;
  card_cvv: string;
  expire_month: number;
  expire_year: number;
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

async function callFunction<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    apikey: supabaseAnonKey,
  };
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  const rawText = await res.text();
  let data: T & { ok?: boolean; error?: string };
  try {
    data = JSON.parse(rawText) as T & { ok?: boolean; error?: string };
  } catch {
    if (res.status === 404) {
      throw new Error(`Servicio de pagos no disponible (${path}). ¿Está desplegado en Supabase?`);
    }
    throw new Error(`Error ${res.status} en el servidor de pagos`);
  }

  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? 'Error en el servidor de pagos');
  }

  return data;
}

/** Cobra una factura con tarjeta guardada. */
export async function pagarFacturaConTarjetaGuardada(
  facturaId: string,
  metodoId: string
): Promise<{ ok: boolean; factura_id?: string }> {
  return callFunction('pixelpay-charge', {
    method: 'POST',
    body: JSON.stringify({ factura_id: facturaId, metodo_id: metodoId }),
  });
}

/** Cobra una factura con datos de tarjeta (formulario en la app). */
export async function pagarFacturaConTarjeta(
  facturaId: string,
  tarjeta: DatosTarjeta,
  guardarTarjeta = false
): Promise<{ ok: boolean; factura_id?: string }> {
  return callFunction('pixelpay-charge', {
    method: 'POST',
    body: JSON.stringify({
      factura_id: facturaId,
      card_number: tarjeta.card_number.replace(/\s/g, ''),
      card_holder: tarjeta.card_holder.trim(),
      card_cvv: tarjeta.card_cvv,
      expire_month: tarjeta.expire_month,
      expire_year: tarjeta.expire_year,
      guardar_tarjeta: guardarTarjeta,
    }),
  });
}

/** Guarda una tarjeta sin cobrar (tokenización). */
export async function guardarTarjeta(tarjeta: DatosTarjeta): Promise<{ ok: boolean; metodo?: MetodoPagoTarjeta }> {
  return callFunction('pixelpay-tokenize', {
    method: 'POST',
    body: JSON.stringify({
      card_number: tarjeta.card_number.replace(/\s/g, ''),
      card_holder: tarjeta.card_holder.trim(),
      card_cvv: tarjeta.card_cvv,
      expire_month: tarjeta.expire_month,
      expire_year: tarjeta.expire_year,
    }),
  });
}

export async function listarMetodosPago(): Promise<MetodoPagoTarjeta[]> {
  const data = await callFunction<{ ok: boolean; metodos: MetodoPagoTarjeta[] }>(
    'pixelpay-payment-methods',
    { method: 'GET' }
  );
  return data.metodos ?? [];
}

export async function eliminarMetodoPago(metodoId: string): Promise<void> {
  await callFunction(`pixelpay-payment-methods?metodo_id=${encodeURIComponent(metodoId)}`, {
    method: 'DELETE',
  });
}

export async function marcarMetodoPredeterminado(metodoId: string): Promise<void> {
  await callFunction('pixelpay-payment-methods', {
    method: 'PATCH',
    body: JSON.stringify({ metodo_id: metodoId }),
  });
}

export function etiquetaMetodoPago(m: MetodoPagoTarjeta): string {
  const marca = m.marca ? m.marca.charAt(0).toUpperCase() + m.marca.slice(1) : 'Tarjeta';
  const digitos = m.ultimos_digitos ? ` ···· ${m.ultimos_digitos}` : '';
  return `${marca}${digitos}`;
}

export function parseExpiry(expiry: string): { month: number; year: number } | null {
  const cleaned = expiry.replace(/\s/g, '');
  const match = cleaned.match(/^(\d{2})\/?(\d{2,4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  let year = Number(match[2]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || year < new Date().getFullYear()) return null;
  return { month, year };
}

export function validarDatosTarjeta(tarjeta: DatosTarjeta): string | null {
  const digits = tarjeta.card_number.replace(/\s/g, '');
  if (digits.length < 15 || digits.length > 16) return 'Número de tarjeta inválido';
  if (!tarjeta.card_holder.trim()) return 'Ingresá el nombre del titular';
  if (!/^\d{3,4}$/.test(tarjeta.card_cvv)) return 'CVV inválido';
  if (tarjeta.expire_month < 1 || tarjeta.expire_month > 12) return 'Mes de vencimiento inválido';
  if (tarjeta.expire_year < new Date().getFullYear()) return 'La tarjeta está vencida';
  return null;
}
