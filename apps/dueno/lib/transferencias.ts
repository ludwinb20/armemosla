import { supabase } from './supabase';
import { dispatchNotification } from './push/dispatchNotification';

export type EstadoTransferencia =
  | 'pendiente_revision'
  | 'confirmada'
  | 'rechazada'
  | 'reembolsada';

export interface CuentaBancaria {
  id: string;
  banco_nombre: string;
  logo_url: string | null;
  numero_cuenta: string;
  titular: string;
  activo: boolean;
  orden: number;
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

export interface TransferenciaFactura {
  id: string;
  transferencia_id: string;
  factura_id: string;
  monto_aplicado: number;
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

export interface ReportarTransferenciaParams {
  facturaId: string;
  cuentaId: string;
  numeroTransaccion: string;
  monto: number;
  solicitaRtn?: boolean;
}

export async function listarCuentasBancarias(): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase
    .from('cuentas_bancarias_armemosla')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) throw error;
  return (data || []) as CuentaBancaria[];
}

export async function reportarTransferencia(
  params: ReportarTransferenciaParams
): Promise<string> {
  const { data, error } = await supabase.rpc('reportar_transferencia', {
    p_factura_id: params.facturaId,
    p_cuenta_bancaria_id: params.cuentaId,
    p_numero_transaccion: params.numeroTransaccion.trim(),
    p_monto: params.monto,
    p_solicita_factura_rtn: params.solicitaRtn ?? false,
  });

  if (error) throw error;
  return data as string;
}

export async function getMontoPendiente(facturaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('monto_pendiente_factura', {
    p_factura_id: facturaId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function getMontoConfirmado(facturaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('monto_confirmado_factura', {
    p_factura_id: facturaId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function getHistorialTransferencias(
  facturaId: string
): Promise<(Transferencia & { monto_aplicado: number })[]> {
  const { data: links, error: linkError } = await supabase
    .from('transferencia_facturas')
    .select('transferencia_id, monto_aplicado')
    .eq('factura_id', facturaId);

  if (linkError) throw linkError;
  if (!links?.length) return [];

  const ids = links.map((l) => l.transferencia_id);
  const { data: transferencias, error } = await supabase
    .from('transferencias')
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias_armemosla (
        id, banco_nombre, logo_url, numero_cuenta, titular
      )
    `)
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const montoMap = new Map(links.map((l) => [l.transferencia_id, l.monto_aplicado]));

  return (transferencias || []).map((t) => ({
    ...(t as Transferencia),
    monto_aplicado: Number(montoMap.get(t.id) ?? t.monto),
  }));
}

export async function getReembolsosPorFactura(facturaId: string): Promise<Reembolso[]> {
  const historial = await getHistorialTransferencias(facturaId);
  const ids = historial.map((t) => t.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('reembolsos')
    .select('*')
    .in('transferencia_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Reembolso[];
}

export async function notifyAdminsPagoPendiente(transferenciaId: string): Promise<void> {
  dispatchNotification('pago_pendiente', { transferencia_id: transferenciaId });
}
