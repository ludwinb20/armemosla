import { supabase } from './supabase';

export interface DatosFiscalesCliente {
  admin_id: string;
  razon_social: string;
  rtn: string;
  direccion: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmisorFiscal {
  id: string;
  razon_social: string;
  rtn: string;
  cai: string;
  fecha_emision: string;
  fecha_limite_emision: string;
  activo: boolean;
}

export interface FacturaFiscal {
  id: string;
  factura_id: string;
  emisor_fiscal_id: string;
  transferencia_id: string | null;
  numero_fiscal: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export async function getDatosFiscalesCliente(): Promise<DatosFiscalesCliente | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('datos_fiscales_cliente')
    .select('*')
    .eq('admin_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as DatosFiscalesCliente | null;
}

export async function guardarDatosFiscalesCliente(
  datos: Pick<DatosFiscalesCliente, 'razon_social' | 'rtn' | 'direccion'>
): Promise<DatosFiscalesCliente> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const bloqueado = await datosFiscalesBloqueados(user.id);
  if (bloqueado) {
    throw new Error('No podés editar tus datos fiscales: ya hay facturas fiscales emitidas');
  }

  const payload = {
    admin_id: user.id,
    razon_social: datos.razon_social.trim(),
    rtn: datos.rtn.trim(),
    direccion: datos.direccion?.trim() || null,
  };

  const { data, error } = await supabase
    .from('datos_fiscales_cliente')
    .upsert(payload, { onConflict: 'admin_id' })
    .select()
    .single();

  if (error) throw error;
  return data as DatosFiscalesCliente;
}

export async function datosFiscalesCompletos(): Promise<boolean> {
  const datos = await getDatosFiscalesCliente();
  return Boolean(datos?.razon_social?.trim() && datos?.rtn?.trim());
}

async function datosFiscalesBloqueados(adminId: string): Promise<boolean> {
  const { data: facturas } = await supabase
    .from('facturas_mensuales')
    .select('id')
    .eq('admin_id', adminId);

  if (!facturas?.length) return false;

  const { count, error } = await supabase
    .from('facturas_fiscales')
    .select('id', { count: 'exact', head: true })
    .in('factura_id', facturas.map((f) => f.id));

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getDatosFiscalesBloqueados(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return datosFiscalesBloqueados(user.id);
}

export async function getEmisorFiscalActivo(): Promise<EmisorFiscal | null> {
  const { data, error } = await supabase
    .from('emisor_fiscal_config')
    .select('*')
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as EmisorFiscal | null;
}

export async function getFacturaFiscal(facturaId: string): Promise<FacturaFiscal | null> {
  const { data, error } = await supabase
    .from('facturas_fiscales')
    .select('*')
    .eq('factura_id', facturaId)
    .maybeSingle();

  if (error) throw error;
  return data as FacturaFiscal | null;
}
