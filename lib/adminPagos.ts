import { supabase } from './supabase';
import { dispatchNotification } from './push/dispatchNotification';
import type { Transferencia, CuentaBancaria, Reembolso } from './transferencias';
import type { SolicitudReembolso } from './solicitudesReembolso';
import type { FacturaMensual } from './pagos';

export interface SolicitudReembolsoPendiente extends SolicitudReembolso {
  transferencia?: TransferenciaPendiente;
  admin_email?: string;
  admin_nombre?: string;
}

export interface TransferenciaPendiente extends Transferencia {
  monto_aplicado: number;
  factura_id: string;
  factura?: FacturaMensual;
  admin_email?: string;
  admin_nombre?: string;
  cuenta_bancaria?: CuentaBancaria;
}

export async function esAdminPlataforma(): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_admin_plataforma');
  if (error) {
    console.error('❌ [esAdminPlataforma]', error);
    return false;
  }
  return Boolean(data);
}

async function enrichTransferencias(
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
      ...(t as Transferencia),
      monto_aplicado: Number(link?.monto_aplicado ?? t.monto),
      factura_id: link?.factura_id ?? '',
      factura,
      admin_email: profile?.email,
      admin_nombre: profile?.full_name,
    };
  });
}

export async function listarPagosPendientes(): Promise<TransferenciaPendiente[]> {
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
  return enrichTransferencias(transferencias || []);
}

export async function listarTransferenciasConfirmadas(): Promise<TransferenciaPendiente[]> {
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
  return enrichTransferencias(transferencias || []);
}

export async function confirmarTransferencia(transferenciaId: string) {
  const { data, error } = await supabase.rpc('confirmar_transferencia', {
    p_transferencia_id: transferenciaId,
  });
  if (error) throw error;

  dispatchNotification('pago_confirmado', { transferencia_id: transferenciaId });

  const factura = data as FacturaMensual;
  if (factura?.id && factura.estado_pago === 'pagado') {
    dispatchNotification('factura_pagada', { factura_id: factura.id });
  }

  return factura;
}

export async function rechazarTransferencia(
  transferenciaId: string,
  motivo: string
): Promise<Transferencia> {
  const { data, error } = await supabase.rpc('rechazar_transferencia', {
    p_transferencia_id: transferenciaId,
    p_motivo: motivo,
  });
  if (error) throw error;

  dispatchNotification('pago_rechazado', { transferencia_id: transferenciaId });

  return data as Transferencia;
}

export async function registrarReembolso(
  transferenciaId: string,
  monto: number,
  motivo: string,
  visibleMensaje: string
): Promise<Reembolso> {
  const { data, error } = await supabase.rpc('registrar_reembolso', {
    p_transferencia_id: transferenciaId,
    p_monto: monto,
    p_motivo: motivo,
    p_visible_mensaje: visibleMensaje,
  });
  if (error) throw error;

  dispatchNotification('reembolso_directo', { transferencia_id: transferenciaId });

  return data as Reembolso;
}

export async function getDetalleTransferencia(
  transferenciaId: string
): Promise<TransferenciaPendiente | null> {
  const [pendientes, confirmadas] = await Promise.all([
    listarPagosPendientes(),
    listarTransferenciasConfirmadas(),
  ]);
  return (
    pendientes.find((t) => t.id === transferenciaId) ??
    confirmadas.find((t) => t.id === transferenciaId) ??
    null
  );
}

export async function listarSolicitudesReembolsoPendientes(): Promise<SolicitudReembolsoPendiente[]> {
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

  const enriched = await enrichTransferencias(transferencias || []);
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
  solicitudId: string,
  visibleMensaje: string
): Promise<SolicitudReembolso> {
  const { data, error } = await supabase.rpc('aprobar_solicitud_reembolso', {
    p_solicitud_id: solicitudId,
    p_visible_mensaje: visibleMensaje.trim(),
  });
  if (error) throw error;

  dispatchNotification('reembolso_aprobado', { solicitud_reembolso_id: solicitudId });

  return data as SolicitudReembolso;
}

export async function rechazarSolicitudReembolso(
  solicitudId: string,
  respuesta: string
): Promise<SolicitudReembolso> {
  const { data, error } = await supabase.rpc('rechazar_solicitud_reembolso', {
    p_solicitud_id: solicitudId,
    p_respuesta: respuesta.trim(),
  });
  if (error) throw error;

  dispatchNotification('reembolso_rechazado', { solicitud_reembolso_id: solicitudId });

  return data as SolicitudReembolso;
}
