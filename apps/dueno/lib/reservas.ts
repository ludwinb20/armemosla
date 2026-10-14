import { supabase } from './supabase';
import { dispatchNotification } from './push/dispatchNotification';

export interface Reserva {
  id: string;
  cancha_id: string;
  fecha_hora: string; // TIMESTAMP WITH TIME ZONE
  user_id?: string;
  made_by_player: boolean;
  estado: 'pendiente' | 'completada' | 'cancelada';
  canje_recompensa_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservaRivalInfo {
  equipoNombre: string;
  jugadorNombre?: string | null;
  origen: 'piscina' | 'directo';
}

export interface ReservaWithRelations extends Reserva {
  cancha?: {
    id: string;
    nombre?: string;
    precio_por_hora?: number;
    complejo?: {
      id: string;
      nombre: string;
    };
  };
  usuario?: {
    id: string;
    email?: string;
  };
  /** Rival confirmado (piscina o reto directo aceptado). */
  rival?: ReservaRivalInfo | null;
}

async function enriquecerReservasConRival(
  reservas: ReservaWithRelations[]
): Promise<ReservaWithRelations[]> {
  if (reservas.length === 0) return reservas;

  const reservaIds = reservas.map((r) => r.id);
  const rivalPorReservaId = new Map<string, ReservaRivalInfo>();

  const { data: partidosPiscina, error: errPiscina } = await supabase
    .from('partidos_abiertos')
    .select(`
      reserva_id,
      solicitudes:solicitudes_partidos(
        estado,
        equipo_solicitante:equipos(nombre)
      )
    `)
    .in('reserva_id', reservaIds)
    .eq('estado', 'confirmado');

  if (errPiscina) {
    console.error('❌ [enriquecerReservasConRival] partidos:', errPiscina);
  } else {
    for (const partido of partidosPiscina || []) {
      const solicitudes = (partido as { solicitudes?: { estado: string; equipo_solicitante?: { nombre?: string } }[] }).solicitudes || [];
      const aceptada = solicitudes.find((s) => s.estado === 'aceptada');
      const nombreEquipo = aceptada?.equipo_solicitante?.nombre;
      if (partido.reserva_id && nombreEquipo) {
        rivalPorReservaId.set(partido.reserva_id, {
          equipoNombre: nombreEquipo,
          origen: 'piscina',
        });
      }
    }
  }

  const pendientesRivalDirecto = reservaIds.filter((id) => !rivalPorReservaId.has(id));
  if (pendientesRivalDirecto.length > 0) {
    const { data: retosDirectos, error: errRetos } = await supabase
      .from('retos_directos_jugador')
      .select(`
        reserva_id,
        jugador_objetivo_id,
        jugador_objetivo:profiles!retos_directos_jugador_jugador_objetivo_id_fkey(full_name)
      `)
      .in('reserva_id', pendientesRivalDirecto)
      .eq('estado', 'aceptado');

    if (errRetos) {
      console.error('❌ [enriquecerReservasConRival] retos directos:', errRetos);
    } else if (retosDirectos && retosDirectos.length > 0) {
      const jugadorIds = [
        ...new Set(
          retosDirectos
            .map((r) => r.jugador_objetivo_id as string)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const equipoPorJugadorId = new Map<string, string>();
      if (jugadorIds.length > 0) {
        const { data: membresias } = await supabase
          .from('jugador_equipos')
          .select('jugador_id, equipo:equipos(nombre)')
          .in('jugador_id', jugadorIds);

        for (const m of membresias || []) {
          const nombre = (m as { equipo?: { nombre?: string } }).equipo?.nombre;
          if (m.jugador_id && nombre && !equipoPorJugadorId.has(m.jugador_id)) {
            equipoPorJugadorId.set(m.jugador_id, nombre);
          }
        }
      }

      for (const reto of retosDirectos) {
        if (!reto.reserva_id || rivalPorReservaId.has(reto.reserva_id)) continue;
        const perfil = reto as {
          jugador_objetivo?: { full_name?: string | null };
          jugador_objetivo_id?: string;
        };
        const nombreJugador = perfil.jugador_objetivo?.full_name ?? null;
        const nombreEquipo =
          (reto.jugador_objetivo_id && equipoPorJugadorId.get(reto.jugador_objetivo_id)) ||
          (nombreJugador ? `Equipo de ${nombreJugador}` : 'Rival confirmado');

        rivalPorReservaId.set(reto.reserva_id, {
          equipoNombre: nombreEquipo,
          jugadorNombre: nombreJugador,
          origen: 'directo',
        });
      }
    }
  }

  return reservas.map((reserva) => ({
    ...reserva,
    rival: rivalPorReservaId.get(reserva.id) ?? null,
  }));
}

/**
 * Obtiene reservas en un rango de fechas
 * @param fechaInicio - Fecha de inicio del rango (ISO string)
 * @param fechaFin - Fecha de fin del rango (ISO string)
 * @param canchaId - Opcional: filtrar por cancha específica
 */
export async function getReservas(
  fechaInicio: string,
  fechaFin: string,
  canchaId?: string
): Promise<ReservaWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    let query = supabase
      .from('reservas')
      .select(`
        *,
        cancha:canchas!reservas_cancha_id_fkey (
          id,
          nombre,
          complejo:complejos!canchas_complejo_id_fkey (
            id,
            nombre
          )
        ),
        usuario:profiles (
          id,
          email
        )
      `)
      .gte('fecha_hora', fechaInicio)
      .lte('fecha_hora', fechaFin)
      .order('fecha_hora', { ascending: true });

    // Filtrar por cancha si se especifica
    if (canchaId) {
      query = query.eq('cancha_id', canchaId);
    }

    const { data: reservas, error } = await query;

    if (error) throw error;
    return reservas || [];
  } catch (error: any) {
    console.error('❌ [getReservas] Error:', error);
    throw error;
  }
}

/**
 * Obtiene una reserva por ID
 */
export async function getReservaById(id: string): Promise<ReservaWithRelations | null> {
  try {
    const { data, error } = await supabase
      .from('reservas')
      .select(`
        *,
        cancha:canchas!reservas_cancha_id_fkey (
          id,
          nombre,
          complejo:complejos!canchas_complejo_id_fkey (
            id,
            nombre
          )
        ),
        usuario:profiles (
          id,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [getReservaById] Error:', error);
    throw error;
  }
}

/**
 * Valida que no haya conflictos de horario para una reserva
 * @param canchaId - ID de la cancha
 * @param fechaHora - Fecha y hora de inicio de la reserva (ISO string)
 * @param reservaId - Opcional: ID de la reserva a excluir (para actualizaciones)
 * @returns true si está disponible, false si hay conflicto
 */
export async function validarDisponibilidad(
  canchaId: string,
  fechaHora: string,
  reservaId?: string
): Promise<boolean> {
  try {
    const fechaHoraInicio = new Date(fechaHora);
    const fechaHoraFin = new Date(fechaHoraInicio.getTime() + 60 * 60 * 1000); // +1 hora

    // Buscar todas las reservas pendientes de la cancha en un rango amplio
    // que puedan solaparse con el horario solicitado
    const fechaInicioBusqueda = new Date(fechaHoraInicio.getTime() - 60 * 60 * 1000); // 1 hora antes
    const fechaFinBusqueda = new Date(fechaHoraFin.getTime() + 60 * 60 * 1000); // 1 hora después

    let query = supabase
      .from('reservas')
      .select('id, fecha_hora')
      .eq('cancha_id', canchaId)
      .eq('estado', 'pendiente')
      .gte('fecha_hora', fechaInicioBusqueda.toISOString())
      .lte('fecha_hora', fechaFinBusqueda.toISOString());

    // Excluir la reserva actual si estamos actualizando
    if (reservaId) {
      query = query.neq('id', reservaId);
    }

    const { data: reservas, error } = await query;

    if (error) throw error;

    // Verificar si alguna reserva se solapa con el horario solicitado
    const hayConflicto = (reservas || []).some((reserva: any) => {
      const reservaFechaHora = new Date(reserva.fecha_hora);
      const reservaFechaHoraFin = new Date(reservaFechaHora.getTime() + 60 * 60 * 1000);

      // Verificar solapamiento: dos intervalos se solapan si:
      // - El inicio de uno está dentro del otro, O
      // - El fin de uno está dentro del otro, O
      // - Uno contiene completamente al otro
      return (
        (fechaHoraInicio >= reservaFechaHora && fechaHoraInicio < reservaFechaHoraFin) ||
        (fechaHoraFin > reservaFechaHora && fechaHoraFin <= reservaFechaHoraFin) ||
        (fechaHoraInicio <= reservaFechaHora && fechaHoraFin >= reservaFechaHoraFin)
      );
    });

    return !hayConflicto;
  } catch (error: any) {
    console.error('❌ [validarDisponibilidad] Error:', error);
    throw error;
  }
}

/**
 * Crea una nueva reserva
 */
export async function createReserva(
  reserva: Omit<Reserva, 'id' | 'created_at' | 'updated_at' | 'estado'>
): Promise<Reserva> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Validar disponibilidad
    const disponible = await validarDisponibilidad(reserva.cancha_id, reserva.fecha_hora);
    if (!disponible) {
      throw new Error('La cancha no está disponible en ese horario');
    }

    // Verificar que la cancha pertenezca a un complejo del admin (si made_by_player es false)
    if (!reserva.made_by_player) {
      const { data: cancha } = await supabase
        .from('canchas')
        .select('complejo_id, complejos!inner(admin_id)')
        .eq('id', reserva.cancha_id)
        .single();

      if (!cancha || (cancha.complejos as any).admin_id !== user.id) {
        throw new Error('No tienes permiso para crear reservas en esta cancha');
      }
    }

    // Si made_by_player es true, usar el user_id del usuario autenticado
    const reservaData: any = {
      ...reserva,
      user_id: reserva.made_by_player ? (reserva.user_id || user.id) : null,
      estado: 'pendiente',
    };

    const { data, error } = await supabase
      .from('reservas')
      .insert(reservaData)
      .select()
      .single();

    if (error) throw error;

    if (data?.made_by_player && data.id) {
      dispatchNotification('reserva_nueva', { reserva_id: data.id });
    }

    return data;
  } catch (error: any) {
    console.error('❌ [createReserva] Error:', error);
    throw error;
  }
}

/**
 * Actualiza una reserva
 */
export async function updateReserva(
  id: string,
  updates: Partial<Omit<Reserva, 'id' | 'created_at' | 'updated_at'>>
): Promise<Reserva> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Si se está actualizando fecha_hora, validar disponibilidad
    if (updates.fecha_hora) {
      const disponible = await validarDisponibilidad(
        updates.cancha_id || '',
        updates.fecha_hora,
        id
      );
      if (!disponible) {
        throw new Error('La cancha no está disponible en ese horario');
      }
    }

    const { data, error } = await supabase
      .from('reservas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [updateReserva] Error:', error);
    throw error;
  }
}

/**
 * Cancela una reserva (cambia el estado a 'cancelada')
 */
export async function cancelarReserva(id: string): Promise<Reserva> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: existing } = await supabase
      .from('reservas')
      .select('id, user_id, made_by_player, cancha_id')
      .eq('id', id)
      .maybeSingle();

    const cancelled = await updateReserva(id, { estado: 'cancelada' });

    if (existing?.made_by_player) {
      if (existing.user_id === user.id) {
        dispatchNotification('reserva_cancelada', { reserva_id: id });
      } else if (existing.user_id) {
        const { data: cancha } = await supabase
          .from('canchas')
          .select('complejo:complejos(admin_id)')
          .eq('id', existing.cancha_id)
          .maybeSingle();
        const adminId = (cancha?.complejo as { admin_id?: string } | null)?.admin_id;
        if (adminId === user.id) {
          dispatchNotification('reserva_cancelada_admin', { reserva_id: id });
        }
      }
    }

    return cancelled;
  } catch (error: any) {
    console.error('❌ [cancelarReserva] Error:', error);
    throw error;
  }
}

export const RESERVAS_JUGADOR_PAGE_SIZE = 8;

export type ReservaEstadoFiltro = 'todas' | 'pendiente' | 'completada' | 'cancelada';

const RESERVAS_JUGADOR_SELECT = `
  *,
  cancha:canchas!reservas_cancha_id_fkey (
    id,
    nombre,
    precio_por_hora,
    complejo:complejos!canchas_complejo_id_fkey (
      id,
      nombre
    )
  ),
  usuario:profiles (
    id,
    email
  )
`;

function filtrarReservasJugadorValidas(
  reservas: ReservaWithRelations[] | null,
  userId: string
): ReservaWithRelations[] {
  const validadas = (reservas || []).filter(
    (r) => r.user_id === userId && r.made_by_player === true
  );
  if (validadas.length !== (reservas || []).length) {
    console.warn(
      '⚠️ [obtenerReservasJugador] Se filtraron reservas inconsistentes',
      `Esperadas: ${reservas?.length || 0}, Válidas: ${validadas.length}`
    );
  }
  return validadas;
}

/**
 * Reservas del jugador paginadas (más recientes primero).
 */
export async function obtenerReservasJugadorPaginado(
  offset: number,
  limit: number = RESERVAS_JUGADOR_PAGE_SIZE,
  estado: ReservaEstadoFiltro = 'todas'
): Promise<{ items: ReservaWithRelations[]; hasMore: boolean }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    let query = supabase
      .from('reservas')
      .select(RESERVAS_JUGADOR_SELECT)
      .eq('user_id', user.id)
      .eq('made_by_player', true)
      .order('fecha_hora', { ascending: false });

    if (estado !== 'todas') {
      query = query.eq('estado', estado);
    }

    const { data: reservas, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ [obtenerReservasJugadorPaginado] Error en consulta:', error);
      throw error;
    }

    const reservasValidadas = filtrarReservasJugadorValidas(
      (reservas || []) as ReservaWithRelations[],
      user.id
    );
    const items = await enriquecerReservasConRival(reservasValidadas);

    return {
      items,
      hasMore: (reservas || []).length === limit,
    };
  } catch (error: unknown) {
    console.error('❌ [obtenerReservasJugadorPaginado] Error:', error);
    throw error;
  }
}

/**
 * Obtiene todas las reservas del jugador actual
 * Solo incluye reservas donde:
 * - user_id coincide con el usuario actual
 * - made_by_player = true (hechas como jugador, no como administrador)
 *
 * Ordenadas por fecha_hora descendente (más recientes primero)
 */
export async function obtenerReservasJugador(): Promise<ReservaWithRelations[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: reservas, error } = await supabase
      .from('reservas')
      .select(RESERVAS_JUGADOR_SELECT)
      .eq('user_id', user.id)
      .eq('made_by_player', true)
      .order('fecha_hora', { ascending: false });

    if (error) {
      console.error('❌ [obtenerReservasJugador] Error en consulta:', error);
      throw error;
    }

    const reservasValidadas = filtrarReservasJugadorValidas(
      (reservas || []) as ReservaWithRelations[],
      user.id
    );

    return enriquecerReservasConRival(reservasValidadas);
  } catch (error: unknown) {
    console.error('❌ [obtenerReservasJugador] Error:', error);
    throw error;
  }
}

/**
 * Crea una reserva simplificada para jugadores
 * Wrapper de createReserva con valores por defecto para jugadores
 */
export async function crearReservaJugador(
  canchaId: string,
  fechaHora: string
): Promise<Reserva> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    return await createReserva({
      cancha_id: canchaId,
      fecha_hora: fechaHora,
      user_id: user.id,
      made_by_player: true,
    });
  } catch (error: any) {
    console.error('❌ [crearReservaJugador] Error:', error);
    throw error;
  }
}
