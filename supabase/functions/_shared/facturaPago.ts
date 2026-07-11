import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export interface FacturaPago {
  id: string;
  admin_id: string;
  mes: number;
  año: number;
  estado_pago: string;
  comision: number;
  comision_neta: number | null;
  monto_mora: number | null;
}

export async function loadFacturaParaPago(
  admin: SupabaseClient,
  facturaId: string,
  userId: string
): Promise<{ factura: FacturaPago; total: number; descripcion: string } | { error: string; status: number }> {
  await admin.rpc('procesar_politicas_pago_facturas');

  const { data: factura, error: facturaError } = await admin
    .from('facturas_mensuales')
    .select('id, admin_id, mes, año, estado_pago, comision, comision_neta, monto_mora')
    .eq('id', facturaId)
    .eq('admin_id', userId)
    .single();

  if (facturaError || !factura) {
    return { error: 'Factura no encontrada', status: 404 };
  }

  if (factura.estado_pago === 'pagado') {
    return { error: 'Esta factura ya está pagada', status: 409 };
  }

  const comisionBase = Number(factura.comision_neta ?? factura.comision ?? 0);
  const mora = Number(factura.monto_mora ?? 0);
  const total = comisionBase + mora;

  if (total <= 0) {
    return { error: 'No hay monto pendiente en esta factura', status: 422 };
  }

  const descripcion = `Armemosla · Factura ${MESES[factura.mes - 1]} ${factura.año}`;

  return { factura: factura as FacturaPago, total, descripcion };
}
