import { supabase } from './supabase';
import { ReservaWithRelations } from './reservas';

export type RecompensaTipo = 'porcentaje' | 'monto_fijo' | 'reserva_gratis';
export type RecompensaEstado = 'disponible' | 'canjeada' | 'expirada';

export interface Logro {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  icono: string;
  activo: boolean;
  orden: number;
  criterio_tipo: string;
  criterio_params: { cantidad?: number };
  recompensa_tipo: RecompensaTipo;
  recompensa_valor: number;
  recompensa_restricciones: Record<string, unknown>;
}

export interface LogroConProgreso extends Logro {
  progreso?: {
    valor_actual: number;
    valor_meta: number;
    metadata: Record<string, unknown>;
    completado_at?: string | null;
    cancha_nombre?: string | null;
  };
}

export interface RecompensaJugador {
  id: string;
  logro_id: string;
  estado: RecompensaEstado;
  canje_token: string;
  recompensa_tipo: RecompensaTipo;
  recompensa_valor: number;
  recompensa_restricciones: Record<string, unknown>;
  cancha_id_restriccion?: string | null;
  expires_at?: string | null;
  created_at: string;
  logro?: Pick<Logro, 'titulo' | 'descripcion' | 'icono' | 'codigo'>;
  cancha_restriccion?: { id: string; nombre: string } | null;
}

export function formatoQrCanje(token: string): string {
  return `ARMSLA:CANJE:${token}`;
}

export function parsearQrCanje(payload: string): string | null {
  const trimmed = payload.trim();
  const prefix = 'ARMSLA:CANJE:';
  if (!trimmed.startsWith(prefix)) return null;
  const token = trimmed.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function metaFromLogro(logro: Logro): number {
  const cantidad = logro.criterio_params?.cantidad;
  return typeof cantidad === 'number' && cantidad > 0 ? cantidad : 1;
}

/**
 * Recalcula progreso y recompensas desde reservas completadas (made_by_player).
 * Debe ejecutarse al abrir Logros: el cron solo actualiza estado; esto alinea jugador_logro_progreso.
 */
export type SyncLogrosResult =
  | { ok: true }
  | { ok: false; reason: 'rpc_missing' | 'error'; message: string };

/** Recalcula progreso vía RPC. Si falta la migración 32 en Supabase, devuelve ok:false sin romper la UI. */
export async function sincronizarLogrosJugador(): Promise<SyncLogrosResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase.rpc('evaluar_logros_jugador', {
    p_user_id: user.id,
  });

  if (!error) {
    return { ok: true };
  }

  const code = (error as { code?: string }).code;
  if (code === 'PGRST202') {
    return {
      ok: false,
      reason: 'rpc_missing',
      message:
        'Falta ejecutar db_settings/32_logros_evaluacion.sql y 37_logros_sync_grants.sql en Supabase.',
    };
  }

  console.error('❌ [sincronizarLogrosJugador]', error);
  return {
    ok: false,
    reason: 'error',
    message: error.message || 'No se pudo sincronizar logros',
  };
}

export async function obtenerLogrosJugador(): Promise<LogroConProgreso[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data: logros, error: errLogros } = await supabase
    .from('logros')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (errLogros) throw errLogros;

  const { data: progresos, error: errProg } = await supabase
    .from('jugador_logro_progreso')
    .select('*')
    .eq('user_id', user.id);

  if (errProg) throw errProg;

  const progresoMap = new Map((progresos || []).map((p) => [p.logro_id, p]));
  const canchaIds = new Set<string>();

  for (const p of progresos || []) {
    const canchaId = (p.metadata as { cancha_id?: string })?.cancha_id;
    if (canchaId) canchaIds.add(canchaId);
  }

  let canchaNombres = new Map<string, string>();
  if (canchaIds.size > 0) {
    const { data: canchas } = await supabase
      .from('canchas')
      .select('id, nombre')
      .in('id', Array.from(canchaIds));
    canchaNombres = new Map((canchas || []).map((c) => [c.id, c.nombre]));
  }

  return (logros || []).map((logro) => {
    const prog = progresoMap.get(logro.id);
    const meta = prog?.valor_meta ?? metaFromLogro(logro as Logro);
    const metadata = (prog?.metadata as Record<string, unknown>) || {};
    const canchaId = metadata.cancha_id as string | undefined;

    return {
      ...(logro as Logro),
      progreso: {
        valor_actual: prog?.valor_actual ?? 0,
        valor_meta: meta,
        metadata,
        completado_at: prog?.completado_at,
        cancha_nombre: canchaId ? canchaNombres.get(canchaId) ?? null : null,
      },
    };
  });
}

export async function obtenerRecompensasDisponibles(): Promise<RecompensaJugador[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('jugador_recompensas')
    .select(`
      *,
      logro:logros ( titulo, descripcion, icono, codigo )
    `)
    .eq('user_id', user.id)
    .eq('estado', 'disponible')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ahora = Date.now();
  const vigentes = (data || []).filter(
    (r) => !r.expires_at || new Date(r.expires_at).getTime() >= ahora
  );

  const canchaIds = vigentes
    .map((r) => r.cancha_id_restriccion)
    .filter(Boolean) as string[];

  let canchaMap = new Map<string, { id: string; nombre: string }>();
  if (canchaIds.length > 0) {
    const { data: canchas } = await supabase
      .from('canchas')
      .select('id, nombre')
      .in('id', canchaIds);
    canchaMap = new Map((canchas || []).map((c) => [c.id, c]));
  }

  return vigentes.map((item) => ({
    ...item,
    logro: item.logro as RecompensaJugador['logro'],
    cancha_restriccion: item.cancha_id_restriccion
      ? canchaMap.get(item.cancha_id_restriccion) ?? null
      : null,
  }));
}

export async function obtenerReservasElegiblesParaCanje(
  recompensa: RecompensaJugador
): Promise<ReservaWithRelations[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  let query = supabase
    .from('reservas')
    .select(`
      *,
      cancha:canchas!reservas_cancha_id_fkey (
        id,
        nombre,
        precio_por_hora,
        complejo:complejos!canchas_complejo_id_fkey (
          id,
          nombre
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('estado', 'pendiente')
    .eq('made_by_player', true)
    .is('canje_recompensa_id', null)
    .gte('fecha_hora', new Date().toISOString())
    .order('fecha_hora', { ascending: true });

  if (recompensa.cancha_id_restriccion) {
    query = query.eq('cancha_id', recompensa.cancha_id_restriccion);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Texto para el modal QR del jugador (sin listar reservas). */
export function textoInstruccionCanjeRecompensa(recompensa: RecompensaJugador): string {
  const beneficio = descripcionRecompensa(recompensa);
  const cancha =
    recompensa.cancha_restriccion?.nombre?.trim() ||
    (recompensa.cancha_id_restriccion ? 'la cancha de tu logro' : null);

  if (cancha) {
    return `Cuando tengas una reserva pendiente en ${cancha}, mostrá este código al administrador al llegar. Él lo escaneará y se aplicará ${beneficio} a esa reserva.`;
  }

  return `En cualquiera de tus próximas reservas pendientes, mostrá este código al administrador al llegar a la cancha. Él lo escaneará y se aplicará ${beneficio} a esa reserva.`;
}

export function descripcionRecompensa(recompensa: RecompensaJugador): string {
  if (recompensa.recompensa_tipo === 'reserva_gratis') {
    return 'Reserva gratis (100%)';
  }
  if (recompensa.recompensa_tipo === 'porcentaje') {
    return `${recompensa.recompensa_valor}% de descuento`;
  }
  return `L ${Number(recompensa.recompensa_valor).toFixed(2)} de descuento`;
}

export function textoProgresoLogro(logro: LogroConProgreso): string {
  const actual = logro.progreso?.valor_actual ?? 0;
  const meta = logro.progreso?.valor_meta ?? metaFromLogro(logro);

  if (logro.criterio_tipo === 'reservas_completadas_misma_cancha') {
    const cancha = logro.progreso?.cancha_nombre;
    return cancha
      ? `${actual}/${meta} reservas en ${cancha}`
      : `${actual}/${meta} reservas en la misma cancha`;
  }

  if (logro.criterio_tipo === 'canchas_distintas_jugadas') {
    return `${actual}/${meta} canchas distintas`;
  }

  return `${actual}/${meta}`;
}

/** Aclaración breve cuando el progreso puede confundirse con otras reservas del jugador. */
export function aclaracionProgresoLogro(logro: LogroConProgreso): string | null {
  if (logro.criterio_tipo !== 'reservas_completadas_misma_cancha') return null;

  const cancha = logro.progreso?.cancha_nombre;
  if (cancha) {
    return `Solo suman reservas completadas hechas por vos en ${cancha}. Otras canchas o reservas del panel admin no cuentan.`;
  }
  return 'Solo suman reservas completadas hechas por vos en una misma cancha.';
}
