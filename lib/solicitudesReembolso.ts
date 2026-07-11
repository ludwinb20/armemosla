import { supabase } from './supabase';
import { dispatchNotification } from './push/dispatchNotification';

export type EstadoSolicitudReembolso = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

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

export async function solicitarReembolso(
  transferenciaId: string,
  monto: number,
  motivo: string
): Promise<string> {
  const { data, error } = await supabase.rpc('solicitar_reembolso', {
    p_transferencia_id: transferenciaId,
    p_monto: monto,
    p_motivo: motivo.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function getSolicitudesPorFactura(facturaId: string): Promise<SolicitudReembolso[]> {
  const { data: links, error: linkError } = await supabase
    .from('transferencia_facturas')
    .select('transferencia_id')
    .eq('factura_id', facturaId);

  if (linkError) throw linkError;
  const ids = (links || []).map((l) => l.transferencia_id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('solicitudes_reembolso')
    .select('*')
    .in('transferencia_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SolicitudReembolso[];
}

export async function getSolicitudPendientePorTransferencia(
  transferenciaId: string
): Promise<SolicitudReembolso | null> {
  const { data, error } = await supabase
    .from('solicitudes_reembolso')
    .select('*')
    .eq('transferencia_id', transferenciaId)
    .eq('estado', 'pendiente')
    .maybeSingle();

  if (error) throw error;
  return data as SolicitudReembolso | null;
}

export async function cancelarSolicitudReembolso(solicitudId: string): Promise<void> {
  const { error } = await supabase
    .from('solicitudes_reembolso')
    .update({ estado: 'cancelada' })
    .eq('id', solicitudId)
    .eq('estado', 'pendiente');

  if (error) throw error;
}

export async function notifyAdminsSolicitudReembolso(solicitudId: string): Promise<void> {
  dispatchNotification('solicitud_reembolso_nueva', { solicitud_reembolso_id: solicitudId });
}
