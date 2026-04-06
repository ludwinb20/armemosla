import { supabase } from './supabase';

export interface FacturaMensual {
  id: string;
  admin_id: string;
  mes: number;
  año: number;
  total_facturado: number;
  comision: number;
  estado_pago: 'pendiente' | 'pagado' | 'vencido';
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

/**
 * Calcula y crea/actualiza una factura mensual
 */
export async function calcularFacturaMes(
  adminId: string,
  mes: number,
  año: number
): Promise<FacturaMensual> {
  try {
    const { data, error } = await supabase.rpc('calcular_factura_mensual', {
      p_admin_id: adminId,
      p_mes: mes,
      p_año: año,
    });

    if (error) throw error;

    // Obtener la factura creada/actualizada
    const factura = await getFacturaMes(adminId, mes, año);
    if (!factura) {
      throw new Error('Error al crear la factura');
    }

    return factura;
  } catch (error: any) {
    console.error('❌ [calcularFacturaMes] Error:', error);
    throw error;
  }
}

/**
 * Obtiene una factura específica por mes y año
 */
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
        // No encontrado
        return null;
      }
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('❌ [getFacturaMes] Error:', error);
    throw error;
  }
}

/**
 * Obtiene una factura por ID
 */
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

    // Obtener detalles
    const detalles = await getDesglosePorCancha(id);

    return {
      ...factura,
      detalles,
    };
  } catch (error: any) {
    console.error('❌ [getFacturaById] Error:', error);
    throw error;
  }
}

/**
 * Obtiene el historial de facturas del administrador actual
 */
export async function getHistorialFacturas(): Promise<FacturaMensual[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('facturas_mensuales')
      .select('*')
      .eq('admin_id', user.id)
      .order('año', { ascending: false })
      .order('mes', { ascending: false });

    if (error) throw error;

    // Actualizar estados de pago vencidos
    await actualizarEstadosPagoVencidos();

    // Re-consultar para obtener estados actualizados
    const { data: dataActualizada, error: errorActualizada } = await supabase
      .from('facturas_mensuales')
      .select('*')
      .eq('admin_id', user.id)
      .order('año', { ascending: false })
      .order('mes', { ascending: false });

    if (errorActualizada) throw errorActualizada;

    return (dataActualizada || []).map(calcularEstadoPagoActualizado);
  } catch (error: any) {
    console.error('❌ [getHistorialFacturas] Error:', error);
    throw error;
  }
}

/**
 * Marca una factura como pagada
 */
export async function marcarFacturaPagada(facturaId: string): Promise<FacturaMensual> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('facturas_mensuales')
      .update({
        estado_pago: 'pagado',
        fecha_pago: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', facturaId)
      .eq('admin_id', user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Factura no encontrada');

    return data;
  } catch (error: any) {
    console.error('❌ [marcarFacturaPagada] Error:', error);
    throw error;
  }
}

/**
 * Obtiene el desglose de una factura por cancha
 */
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

    return (data || []).map((item: any) => ({
      ...item,
      cancha: item.cancha,
    }));
  } catch (error: any) {
    console.error('❌ [getDesglosePorCancha] Error:', error);
    throw error;
  }
}

/**
 * Calcula el estado de pago actualizado basado en fecha límite
 */
export function calcularEstadoPago(fechaLimite: string, fechaPago?: string | null): 'pendiente' | 'pagado' | 'vencido' {
  if (fechaPago) {
    return 'pagado';
  }

  const ahora = new Date();
  const limite = new Date(fechaLimite);

  if (ahora > limite) {
    return 'vencido';
  }

  return 'pendiente';
}

/**
 * Calcula el estado de pago y actualiza el objeto factura
 */
function calcularEstadoPagoActualizado(factura: FacturaMensual): FacturaMensual {
  const estadoActualizado = calcularEstadoPago(factura.fecha_limite_pago, factura.fecha_pago);
  return {
    ...factura,
    estado_pago: estadoActualizado,
  };
}

/**
 * Actualiza los estados de pago vencidos en la base de datos
 */
async function actualizarEstadosPagoVencidos(): Promise<void> {
  try {
    const { error } = await supabase.rpc('actualizar_estados_pago_vencidos');
    if (error) {
      console.error('❌ [actualizarEstadosPagoVencidos] Error:', error);
      // No lanzar error, solo loguear
    }
  } catch (error: any) {
    console.error('❌ [actualizarEstadosPagoVencidos] Error:', error);
    // No lanzar error, solo loguear
  }
}

/**
 * Obtiene o calcula la factura del mes actual
 */
export async function getFacturaMesActual(): Promise<FacturaMensual | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const ahora = new Date();
    const mes = ahora.getMonth() + 1; // JavaScript months are 0-indexed
    const año = ahora.getFullYear();

    // Calcular/actualizar la factura del mes actual
    const factura = await calcularFacturaMes(user.id, mes, año);

    return factura;
  } catch (error: any) {
    console.error('❌ [getFacturaMesActual] Error:', error);
    throw error;
  }
}
