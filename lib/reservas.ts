import { supabase } from './supabase';

export interface Reserva {
  id: string;
  cancha_id: string;
  fecha_hora: string; // TIMESTAMP WITH TIME ZONE
  user_id?: string;
  made_by_player: boolean;
  estado: 'pendiente' | 'completada' | 'cancelada';
  created_at: string;
  updated_at: string;
}

export interface ReservaWithRelations extends Reserva {
  cancha?: {
    id: string;
    nombre?: string;
    complejo?: {
      id: string;
      nombre: string;
    };
  };
  usuario?: {
    id: string;
    email?: string;
  };
}

/**
 * Auto-completa reservas pendientes que ya pasaron su fecha_hora + 30 minutos
 * Esta función debe llamarse antes de consultar reservas para mantener el estado actualizado
 */
export async function autoCompletarReservas(): Promise<void> {
  try {
    const { error } = await supabase.rpc('auto_completar_reservas');
    if (error) {
      console.error('❌ [autoCompletarReservas] Error:', error);
      // No lanzar error, solo loguear, ya que esto es una función de mantenimiento
    }
  } catch (error: any) {
    console.error('❌ [autoCompletarReservas] Error:', error);
    // No lanzar error, solo loguear
  }
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
    // Auto-completar reservas antes de consultar
    await autoCompletarReservas();

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
    return await updateReserva(id, { estado: 'cancelada' });
  } catch (error: any) {
    console.error('❌ [cancelarReserva] Error:', error);
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
    await autoCompletarReservas();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Nota: user.id de auth.users debería coincidir con profiles.id
    // La tabla reservas.user_id hace referencia a profiles.id
    const { data: reservas, error } = await supabase
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
        ),
        usuario:profiles (
          id,
          email
        )
      `)
      // Filtrar solo reservas hechas por este usuario COMO JUGADOR
      // No incluye reservas hechas por administradores (made_by_player = false)
      .eq('user_id', user.id)
      .eq('made_by_player', true)
      .order('fecha_hora', { ascending: false });

    if (error) {
      console.error('❌ [obtenerReservasJugador] Error en consulta:', error);
      throw error;
    }

    // Validación adicional: filtrar cualquier reserva que no cumpla los criterios
    // (por si acaso hay datos inconsistentes en la base de datos)
    const reservasValidadas = (reservas || []).filter(
      (r) => r.user_id === user.id && r.made_by_player === true
    );

    if (reservasValidadas.length !== (reservas || []).length) {
      console.warn(
        '⚠️ [obtenerReservasJugador] Se filtraron reservas inconsistentes',
        `Esperadas: ${reservas?.length || 0}, Válidas: ${reservasValidadas.length}`
      );
    }

    return reservasValidadas;
  } catch (error: any) {
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
