import { supabase } from './supabase';

export type EstadoPago = 'pendiente' | 'pagado' | 'retrasado';

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

export interface FacturaDetalleCancha {
  id: string;
  factura_id: string;
  cancha_id: string;
  total_reservas: number;
  total_facturado: number;
  comision: number;
  created_at: string;
  cancha?: {
    id: string;
    nombre: string;
    complejo?: {
      id: string;
      nombre: string;
    };
  };
}

export interface FacturaWithDetalles extends FacturaMensual {
  detalles?: FacturaDetalleCancha[];
}

const MESES_NOMBRE = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Mes calendario anterior al actual (mes 1-12). */
export function getPeriodoMesAnterior(): { mes: number; año: number } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { mes: d.getMonth() + 1, año: d.getFullYear() };
}

/** Día 1 del mes siguiente al periodo facturado — inicio de ventana de pago. */
export function getFechaDisponiblePago(mes: number, año: number): Date {
  return new Date(año, mes, 1);
}

/** Día 1 dos meses después del periodo facturado — fin de mora y ocultamiento de complejos. */
export function getFechaOcultamientoComplejos(mes: number, año: number): Date {
  return new Date(año, mes + 1, 1);
}

/** La mora deja de aumentar a partir del día 1 del mes M+2. */
export function moraCongelada(factura: FacturaMensual): boolean {
  if (factura.estado_pago !== 'retrasado' || factura.fecha_pago) return false;
  return new Date() >= getFechaOcultamientoComplejos(factura.mes, factura.año);
}

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getComisionBase(factura: FacturaMensual): number {
  if (factura.comision_neta != null) {
    return toAmount(factura.comision_neta);
  }
  return toAmount(factura.comision);
}

export function getTotalAPagar(factura: FacturaMensual): number {
  return getComisionBase(factura) + toAmount(factura.monto_mora);
}

export function esFacturaPagable(factura: FacturaMensual): boolean {
  if (factura.estado_pago === 'pagado' || factura.fecha_pago) {
    return false;
  }
  const disponible = getFechaDisponiblePago(factura.mes, factura.año);
  return new Date() >= disponible;
}

export function textoDisponibilidadPago(factura: FacturaMensual): string {
  const disponible = getFechaDisponiblePago(factura.mes, factura.año);
  const mesNombre = MESES_NOMBRE[disponible.getMonth()];
  return `Disponible para pago a partir del 1 de ${mesNombre} de ${disponible.getFullYear()}`;
}

export function textoProximoPagoMesActual(): string {
  const ahora = new Date();
  const mesNombre = MESES_NOMBRE[(ahora.getMonth() + 1) % 12];
  const año = ahora.getMonth() === 11 ? ahora.getFullYear() + 1 : ahora.getFullYear();
  return `Podrás pagar esta factura a partir del 1 de ${mesNombre} de ${año}`;
}

export async function procesarPoliticasPago(): Promise<void> {
  try {
    const { error } = await supabase.rpc('procesar_politicas_pago_facturas');
    if (error) {
      console.error('❌ [procesarPoliticasPago] Error:', error);
    }
  } catch (error) {
    console.error('❌ [procesarPoliticasPago] Error:', error);
  }
}

export async function calcularFacturaMes(
  adminId: string,
  mes: number,
  año: number
): Promise<FacturaMensual> {
  try {
    const { error } = await supabase.rpc('calcular_factura_mensual', {
      p_admin_id: adminId,
      p_mes: mes,
      p_año: año,
    });

    if (error) throw error;

    const factura = await getFacturaMes(adminId, mes, año);
    if (!factura) {
      throw new Error('Error al crear la factura');
    }

    return factura;
  } catch (error: unknown) {
    console.error('❌ [calcularFacturaMes] Error:', error);
    throw error;
  }
}

export async function getFacturaMes(
  adminId: string,
  mes: number,
  año: number
): Promise<FacturaMensual | null> {
  try {
    const { data, error } = await supabase
      .from('facturas_mensuales')
      .select('*')
      .eq('admin_id', adminId)
      .eq('mes', mes)
      .eq('año', año)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as FacturaMensual;
  } catch (error: unknown) {
    console.error('❌ [getFacturaMes] Error:', error);
    throw error;
  }
}

export async function getFacturaById(id: string): Promise<FacturaWithDetalles | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: factura, error } = await supabase
      .from('facturas_mensuales')
      .select('*')
      .eq('id', id)
      .eq('admin_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    if (!factura) return null;

    // Mismo refresh que la pantalla Pagos: recalcular comisión y aplicar mora
    await procesarPoliticasPago();
    const refreshed = await calcularFacturaMes(user.id, factura.mes, factura.año);
    const detalles = await getDesglosePorCancha(refreshed.id);

    return {
      ...refreshed,
      detalles,
    };
  } catch (error: unknown) {
    console.error('❌ [getFacturaById] Error:', error);
    throw error;
  }
}

export async function getHistorialFacturas(): Promise<FacturaMensual[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    await procesarPoliticasPago();

    const { data, error } = await supabase
      .from('facturas_mensuales')
      .select('*')
      .eq('admin_id', user.id)
      .order('año', { ascending: false })
      .order('mes', { ascending: false });

    if (error) throw error;

    return (data || []) as FacturaMensual[];
  } catch (error: unknown) {
    console.error('❌ [getHistorialFacturas] Error:', error);
    throw error;
  }
}

export async function marcarFacturaPagada(facturaId: string): Promise<FacturaMensual> {
  try {
    const { data, error } = await supabase.rpc('marcar_factura_pagada', {
      p_factura_id: facturaId,
    });

    if (error) throw error;
    if (!data) throw new Error('Factura no encontrada');

    return data as FacturaMensual;
  } catch (error: unknown) {
    console.error('❌ [marcarFacturaPagada] Error:', error);
    throw error;
  }
}

export async function getDesglosePorCancha(facturaId: string): Promise<FacturaDetalleCancha[]> {
  try {
    const { data, error } = await supabase
      .from('factura_detalle_cancha')
      .select(`
        *,
        cancha:canchas!factura_detalle_cancha_cancha_id_fkey (
          id,
          nombre,
          complejo:complejos!canchas_complejo_id_fkey (
            id,
            nombre
          )
        )
      `)
      .eq('factura_id', facturaId)
      .order('total_facturado', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: FacturaDetalleCancha & { cancha?: FacturaDetalleCancha['cancha'] }) => ({
      ...item,
      cancha: item.cancha,
    }));
  } catch (error: unknown) {
    console.error('❌ [getDesglosePorCancha] Error:', error);
    throw error;
  }
}

export function calcularEstadoPago(
  fechaLimite: string,
  fechaPago?: string | null
): EstadoPago {
  if (fechaPago) {
    return 'pagado';
  }

  const ahora = new Date();
  const limite = new Date(fechaLimite);

  if (ahora > limite) {
    return 'retrasado';
  }

  return 'pendiente';
}

export async function getFacturaMesActual(): Promise<FacturaMensual | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const año = ahora.getFullYear();

    return calcularFacturaMes(user.id, mes, año);
  } catch (error: unknown) {
    console.error('❌ [getFacturaMesActual] Error:', error);
    throw error;
  }
}

export async function getFacturaMesPasado(): Promise<FacturaMensual | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { mes, año } = getPeriodoMesAnterior();
    const factura = await calcularFacturaMes(user.id, mes, año);
    return factura;
  } catch (error: unknown) {
    console.error('❌ [getFacturaMesPasado] Error:', error);
    throw error;
  }
}

export async function adminTieneComplejosOcultos(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count, error } = await supabase
      .from('complejos')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', user.id)
      .eq('oculto', true);

    if (error) throw error;
    return (count ?? 0) > 0;
  } catch (error) {
    console.error('❌ [adminTieneComplejosOcultos] Error:', error);
    return false;
  }
}
