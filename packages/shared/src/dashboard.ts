import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoComercial } from './types';

export interface EstadisticasPlataforma {
  generado_en: string;
  usuarios: {
    jugadores: number;
    admins_cancha: number;
    nuevos_30_dias: number;
    nuevos_7_dias: number;
  };
  infraestructura: {
    complejos_total: number;
    complejos_visibles: number;
    complejos_ocultos: number;
    canchas_total: number;
    canchas_activas: number;
  };
  reservas: {
    hoy: number;
    mes_calendario: number;
    completadas_mes: number;
    pendientes_futuras: number;
    nuevas_7_dias: number;
    volumen_completadas_mes: number;
  };
  pagos: {
    transferencias_pendientes: number;
    reembolsos_pendientes: number;
    facturas_pendientes: number;
    comision_pendiente_total: number;
    comision_cobrada_mes: number;
  };
  crm: {
    prospectos_total: number;
    por_estado: Partial<Record<EstadoComercial, number>>;
  };
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseEstadisticas(raw: Record<string, unknown>): EstadisticasPlataforma {
  const u = (raw.usuarios ?? {}) as Record<string, unknown>;
  const inf = (raw.infraestructura ?? {}) as Record<string, unknown>;
  const res = (raw.reservas ?? {}) as Record<string, unknown>;
  const pag = (raw.pagos ?? {}) as Record<string, unknown>;
  const crm = (raw.crm ?? {}) as Record<string, unknown>;
  const porEstado = (crm.por_estado ?? {}) as Record<string, unknown>;

  return {
    generado_en: String(raw.generado_en ?? new Date().toISOString()),
    usuarios: {
      jugadores: num(u.jugadores),
      admins_cancha: num(u.admins_cancha),
      nuevos_30_dias: num(u.nuevos_30_dias),
      nuevos_7_dias: num(u.nuevos_7_dias),
    },
    infraestructura: {
      complejos_total: num(inf.complejos_total),
      complejos_visibles: num(inf.complejos_visibles),
      complejos_ocultos: num(inf.complejos_ocultos),
      canchas_total: num(inf.canchas_total),
      canchas_activas: num(inf.canchas_activas),
    },
    reservas: {
      hoy: num(res.hoy),
      mes_calendario: num(res.mes_calendario),
      completadas_mes: num(res.completadas_mes),
      pendientes_futuras: num(res.pendientes_futuras),
      nuevas_7_dias: num(res.nuevas_7_dias),
      volumen_completadas_mes: num(res.volumen_completadas_mes),
    },
    pagos: {
      transferencias_pendientes: num(pag.transferencias_pendientes),
      reembolsos_pendientes: num(pag.reembolsos_pendientes),
      facturas_pendientes: num(pag.facturas_pendientes),
      comision_pendiente_total: num(pag.comision_pendiente_total),
      comision_cobrada_mes: num(pag.comision_cobrada_mes),
    },
    crm: {
      prospectos_total: num(crm.prospectos_total),
      por_estado: Object.fromEntries(
        Object.entries(porEstado).map(([k, v]) => [k, num(v)])
      ) as Partial<Record<EstadoComercial, number>>,
    },
  };
}

export async function obtenerEstadisticasPlataforma(
  supabase: SupabaseClient
): Promise<EstadisticasPlataforma> {
  const { data, error } = await supabase.rpc('obtener_estadisticas_plataforma');
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta inválida de estadísticas');
  }
  return parseEstadisticas(data as Record<string, unknown>);
}
