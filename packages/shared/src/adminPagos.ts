import type { SupabaseClient } from '@supabase/supabase-js';

export type EstadoTransferencia =
  | 'pendiente_revision'
  | 'confirmada'
  | 'rechazada'
  | 'reembolsada';

export type EstadoPago = 'pendiente' | 'pagado' | 'retrasado' | 'en_revision';

export type EstadoSolicitudReembolso = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface CuentaBancaria {
  id: string;
  banco_nombre: string;
  logo_url: string | null;
  numero_cuenta: string;
  titular: string;
  activo?: boolean;
  orden?: number;
}

export interface Transferencia {
  id: string;
  admin_id: string;
  cuenta_bancaria_id: string;
  numero_transaccion: string;
  monto: number;
  estado: EstadoTransferencia;
  solicita_factura_rtn: boolean;
  notas_admin: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  created_at: string;
  updated_at: string;
  cuenta_bancaria?: CuentaBancaria;
}

export interface FacturaMensual {
  id: string;
  admin_id: string;
  mes: number;
  año: number;
  total_facturado: number;
  comision: number;
  total_descuentos_canje?: number;
  comision_neta?: number;
  dias_retraso?: number;
  monto_mora?: number;
  estado_pago: EstadoPago;
  fecha_limite_pago: string;
  fecha_pago?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reembolso {
  id: string;
  transferencia_id: string;
  monto: number;
  motivo: string;
  visible_mensaje: string;
  creado_por: string;
  created_at: string;
}

export interface SolicitudReembolso {
  id: string;
  transferencia_id: string;
  admin_id: string;
  monto: number;
  motivo: string;
  estado: EstadoSolicitudReembolso;
  respuesta_plataforma: string | null;
  reembolso_id: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferenciaPendiente extends Transferencia {
  monto_aplicado: number;
  factura_id: string;
  factura?: FacturaMensual;
  admin_email?: string;
  admin_nombre?: string;
  cuenta_bancaria?: CuentaBancaria;
}

export interface SolicitudReembolsoPendiente extends SolicitudReembolso {
  transferencia?: TransferenciaPendiente;
  admin_email?: string;
  admin_nombre?: string;
}

export type AdminNotifyFn = (
  type: string,
  payload: Record<string, string>
) => void | Promise<void>;

async function enrichTransferencias(
  supabase: SupabaseClient,
  transferencias: Record<string, unknown>[]
): Promise<TransferenciaPendiente[]> {
  if (!transferencias.length) return [];

  const ids = transferencias.map((t) => t.id as string);
  const { data: links, error: linkError } = await supabase
    .from('transferencia_facturas')
    .select('transferencia_id, factura_id, monto_aplicado')
    .in('transferencia_id', ids);

  if (linkError) throw linkError;

  const facturaIds = [...new Set((links || []).map((l) => l.factura_id))];
  const { data: facturas, error: facturaError } = await supabase
    .from('facturas_mensuales')
    .select('*')
    .in('id', facturaIds);

  if (facturaError) throw facturaError;

  const adminIds = [...new Set((facturas || []).map((f) => f.admin_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', adminIds);

  const facturaMap = new Map((facturas || []).map((f) => [f.id, f as FacturaMensual]));
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const linkMap = new Map((links || []).map((l) => [l.transferencia_id, l]));

  return transferencias.map((t) => {
    const link = linkMap.get(t.id as string);
    const factura = link ? facturaMap.get(link.factura_id) : undefined;
    const profile = factura ? profileMap.get(factura.admin_id) : undefined;
    return {
      ...(t as unknown as Transferencia),
      monto_aplicado: Number(link?.monto_aplicado ?? t.monto),
      factura_id: link?.factura_id ?? '',
      factura,
      admin_email: profile?.email,
      admin_nombre: profile?.full_name,
    };
  });
}

export async function esAdminPlataforma(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_admin_plataforma');
  if (error) return false;
  return Boolean(data);
}

export async function listarPagosPendientes(
  supabase: SupabaseClient
): Promise<TransferenciaPendiente[]> {
  const { data: transferencias, error } = await supabase
    .from('transferencias')
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias_armemosla (
        id, banco_nombre, logo_url, numero_cuenta, titular
      )
    `)
    .eq('estado', 'pendiente_revision')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return enrichTransferencias(supabase, transferencias || []);
}

export async function listarTransferenciasConfirmadas(
  supabase: SupabaseClient
): Promise<TransferenciaPendiente[]> {
  const { data: transferencias, error } = await supabase
    .from('transferencias')
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias_armemosla (
        id, banco_nombre, logo_url, numero_cuenta, titular
      )
    `)
    .eq('estado', 'confirmada')
    .order('revisado_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return enrichTransferencias(supabase, transferencias || []);
}

export async function confirmarTransferencia(
  supabase: SupabaseClient,
  transferenciaId: string,
  notify?: AdminNotifyFn
) {
  const { data, error } = await supabase.rpc('confirmar_transferencia', {
    p_transferencia_id: transferenciaId,
  });
  if (error) throw error;

  await notify?.('pago_confirmado', { transferencia_id: transferenciaId });

  const factura = data as FacturaMensual;
  if (factura?.id && factura.estado_pago === 'pagado') {
    await notify?.('factura_pagada', { factura_id: factura.id });
  }

  return factura;
}

export async function rechazarTransferencia(
  supabase: SupabaseClient,
  transferenciaId: string,
  motivo: string,
  notify?: AdminNotifyFn
): Promise<Transferencia> {
  const { data, error } = await supabase.rpc('rechazar_transferencia', {
    p_transferencia_id: transferenciaId,
    p_motivo: motivo,
  });
  if (error) throw error;

  await notify?.('pago_rechazado', { transferencia_id: transferenciaId });

  return data as Transferencia;
}

export async function registrarReembolso(
  supabase: SupabaseClient,
  transferenciaId: string,
  monto: number,
  motivo: string,
  visibleMensaje: string,
  notify?: AdminNotifyFn
): Promise<Reembolso> {
  const { data, error } = await supabase.rpc('registrar_reembolso', {
    p_transferencia_id: transferenciaId,
    p_monto: monto,
    p_motivo: motivo,
    p_visible_mensaje: visibleMensaje,
  });
  if (error) throw error;

  await notify?.('reembolso_directo', { transferencia_id: transferenciaId });

  return data as Reembolso;
}

export async function listarSolicitudesReembolsoPendientes(
  supabase: SupabaseClient
): Promise<SolicitudReembolsoPendiente[]> {
  const { data: solicitudes, error } = await supabase
    .from('solicitudes_reembolso')
    .select('*')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!solicitudes?.length) return [];

  const transferenciaIds = solicitudes.map((s) => s.transferencia_id);
  const { data: transferencias, error: tError } = await supabase
    .from('transferencias')
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias_armemosla (
        id, banco_nombre, logo_url, numero_cuenta, titular
      )
    `)
    .in('id', transferenciaIds);

  if (tError) throw tError;

  const enriched = await enrichTransferencias(supabase, transferencias || []);
  const transferenciaMap = new Map(enriched.map((t) => [t.id, t]));

  const adminIds = [...new Set(solicitudes.map((s) => s.admin_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', adminIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return solicitudes.map((s) => {
    const profile = profileMap.get(s.admin_id);
    return {
      ...(s as SolicitudReembolso),
      transferencia: transferenciaMap.get(s.transferencia_id),
      admin_email: profile?.email,
      admin_nombre: profile?.full_name,
    };
  });
}

export async function aprobarSolicitudReembolso(
  supabase: SupabaseClient,
  solicitudId: string,
  visibleMensaje: string,
  notify?: AdminNotifyFn
): Promise<SolicitudReembolso> {
  const { data, error } = await supabase.rpc('aprobar_solicitud_reembolso', {
    p_solicitud_id: solicitudId,
    p_visible_mensaje: visibleMensaje.trim(),
  });
  if (error) throw error;

  await notify?.('reembolso_aprobado', { solicitud_reembolso_id: solicitudId });

  return data as SolicitudReembolso;
}

export async function rechazarSolicitudReembolso(
  supabase: SupabaseClient,
  solicitudId: string,
  respuesta: string,
  notify?: AdminNotifyFn
): Promise<SolicitudReembolso> {
  const { data, error } = await supabase.rpc('rechazar_solicitud_reembolso', {
    p_solicitud_id: solicitudId,
    p_respuesta: respuesta.trim(),
  });
  if (error) throw error;

  await notify?.('reembolso_rechazado', { solicitud_reembolso_id: solicitudId });

  return data as SolicitudReembolso;
}
