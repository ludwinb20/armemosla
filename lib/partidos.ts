import { supabase } from './supabase';
import {
  notifyNuevaSolicitudPartido,
  notifySolicitudAceptada,
  notifySolicitudRechazada,
  notifyMatchEncontrado,
} from './notifications';

export interface PartidoAbierto {
  id: string;
  reserva_id: string;
  creador_id?: string;
  equipo_id?: string;
  jugadores_necesarios: number;
  busca_automatico: boolean;
  estado: 'abierto' | 'en_negociacion' | 'confirmado' | 'cancelado';
  created_at: string;
  updated_at: string;
}

export interface SolicitudPartido {
  id: string;
  partido_id: string;
  equipo_solicitante_id?: string;
  mensaje?: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';
  created_at: string;
  updated_at: string;
}

export interface PartidoAbiertoWithRelations extends PartidoAbierto {
  reserva?: {
    id: string;
    fecha_hora: string;
    cancha?: {
      id: string;
      nombre: string;
      complejo?: {
        id: string;
        nombre: string;
        direccion_texto?: string;
        direccion_lat?: number;
        direccion_lng?: number;
      };
    };
  };
  equipo?: {
    id: string;
    nombre: string;
    logo_url?: string;
  };
  creador?: {
    id: string;
    full_name?: string;
    email?: string;
  };
  solicitudes?: SolicitudPartidoWithRelations[];
}

export interface SolicitudPartidoWithRelations extends SolicitudPartido {
  equipo_solicitante?: {
    id: string;
    nombre: string;
    logo_url?: string;
  };
  partido?: PartidoAbiertoWithRelations;
}

export interface FiltrosPartidos {
  estado?: 'abierto' | 'en_negociacion' | 'confirmado' | 'cancelado';
  fechaDesde?: string;
  fechaHasta?: string;
  jugadoresMin?: number;
  jugadoresMax?: number;
}

/**
 * Crea un nuevo partido abierto
 */
export async function crearPartidoAbierto(
  reservaId: string,
  equipoId: string,
  jugadoresNecesarios: number,
  buscaAutomatico: boolean = false
): Promise<PartidoAbierto> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('partidos_abiertos')
      .insert({
        reserva_id: reservaId,
        creador_id: user.id,
        equipo_id: equipoId,
        jugadores_necesarios: jugadoresNecesarios,
        busca_automatico: buscaAutomatico,
        estado: 'abierto',
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo crear el partido abierto');

    // Si busca automático, intentar encontrar match
    if (buscaAutomatico) {
      // Esto se puede hacer en background o inmediatamente
      // Por ahora solo lo marcamos, la búsqueda se puede hacer después
    }

    return data as PartidoAbierto;
  } catch (error: any) {
    console.error('❌ [crearPartidoAbierto] Error:', error);
    throw error;
  }
}

/**
 * Obtiene todos los partidos abiertos disponibles (para buscar rivales)
 */
export async function obtenerPartidosAbiertos(
  filtros?: FiltrosPartidos
): Promise<PartidoAbiertoWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    let query = supabase
      .from('partidos_abiertos')
      .select(`
        *,
        reserva:reservas(
          id,
          fecha_hora,
          cancha:canchas!inner(
            id,
            nombre,
            complejo:complejos!inner(
              id,
              nombre,
              direccion_texto,
              direccion_lat,
              direccion_lng
            )
          )
        ),
        equipo:equipos(
          id,
          nombre,
          logo_url
        ),
        creador:profiles(
          id,
          full_name,
          email
        )
      `)
      .eq('estado', 'abierto')
      .neq('creador_id', user.id); // Excluir los propios

    if (filtros?.fechaDesde) {
      query = query.gte('reservas.fecha_hora', filtros.fechaDesde);
    }

    if (filtros?.fechaHasta) {
      query = query.lte('reservas.fecha_hora', filtros.fechaHasta);
    }

    if (filtros?.jugadoresMin) {
      query = query.gte('jugadores_necesarios', filtros.jugadoresMin);
    }

    if (filtros?.jugadoresMax) {
      query = query.lte('jugadores_necesarios', filtros.jugadoresMax);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []) as PartidoAbiertoWithRelations[];
  } catch (error: any) {
    console.error('❌ [obtenerPartidosAbiertos] Error:', error);
    throw error;
  }
}

/**
 * Obtiene los partidos abiertos creados por el jugador actual
 */
export async function obtenerPartidosJugador(): Promise<PartidoAbiertoWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('partidos_abiertos')
      .select(`
        *,
        reserva:reservas(
          id,
          fecha_hora,
          cancha:canchas(
            id,
            nombre,
            complejo:complejos(
              id,
              nombre,
              direccion_texto,
              direccion_lat,
              direccion_lng
            )
          )
        ),
        equipo:equipos(
          id,
          nombre,
          logo_url
        ),
        solicitudes:solicitudes_partidos(
          id,
          equipo_solicitante_id,
          mensaje,
          estado,
          created_at,
          equipo_solicitante:equipos(
            id,
            nombre,
            logo_url
          )
        )
      `)
      .eq('creador_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []) as PartidoAbiertoWithRelations[];
  } catch (error: any) {
    console.error('❌ [obtenerPartidosJugador] Error:', error);
    throw error;
  }
}

/**
 * Envía una solicitud para un partido abierto
 */
export async function enviarSolicitudPartido(
  partidoId: string,
  equipoId: string,
  mensaje?: string
): Promise<SolicitudPartido> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que el equipo pertenezca al usuario
    const { data: equipo } = await supabase
      .from('jugador_equipos')
      .select('equipo_id')
      .eq('equipo_id', equipoId)
      .eq('jugador_id', user.id)
      .single();

    if (!equipo) {
      throw new Error('No perteneces a este equipo');
    }

    const { data, error } = await supabase
      .from('solicitudes_partidos')
      .insert({
        partido_id: partidoId,
        equipo_solicitante_id: equipoId,
        mensaje,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo enviar la solicitud');

    // Enviar notificación al creador del partido (local)
    try {
      const { data: partido } = await supabase
        .from('partidos_abiertos')
        .select(`
          *,
          equipo:equipos(nombre)
        `)
        .eq('id', partidoId)
        .single();

      if (partido) {
        const equipoSolicitante = await supabase
          .from('equipos')
          .select('nombre')
          .eq('id', equipoId)
          .single();

        if (equipoSolicitante.data) {
          // Notificar al creador del partido
          await notifyNuevaSolicitudPartido(
            equipoSolicitante.data.nombre,
            partidoId
          );
        }
      }
    } catch (notifError) {
      // No fallar si la notificación falla
      console.error('Error al enviar notificación:', notifError);
    }

    return data as SolicitudPartido;
  } catch (error: any) {
    console.error('❌ [enviarSolicitudPartido] Error:', error);
    throw error;
  }
}

/**
 * Acepta una solicitud de partido
 */
export async function aceptarSolicitud(solicitudId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que el usuario sea el creador del partido
    const { data: solicitud } = await supabase
      .from('solicitudes_partidos')
      .select(`
        *,
        partido:partidos_abiertos(creador_id)
      `)
      .eq('id', solicitudId)
      .single();

    if (!solicitud || (solicitud.partido as any).creador_id !== user.id) {
      throw new Error('No tienes permiso para aceptar esta solicitud');
    }

    // Actualizar solicitud a aceptada
    const { error: updateError } = await supabase
      .from('solicitudes_partidos')
      .update({ estado: 'aceptada' })
      .eq('id', solicitudId);

    if (updateError) throw updateError;

    // Rechazar otras solicitudes pendientes del mismo partido
    await supabase
      .from('solicitudes_partidos')
      .update({ estado: 'rechazada' })
      .eq('partido_id', (solicitud.partido as any).id)
      .neq('id', solicitudId)
      .eq('estado', 'pendiente');

    // Actualizar estado del partido a 'en_negociacion'
    await supabase
      .from('partidos_abiertos')
      .update({ estado: 'en_negociacion' })
      .eq('id', (solicitud.partido as any).id);

    // Enviar notificación al equipo solicitante
    try {
      const { data: equipoSolicitante } = await supabase
        .from('equipos')
        .select('nombre')
        .eq('id', (solicitud as any).equipo_solicitante_id)
        .single();

      if (equipoSolicitante) {
        await notifySolicitudAceptada(
          equipoSolicitante.nombre,
          (solicitud.partido as any).id
        );
      }
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }
  } catch (error: any) {
    console.error('❌ [aceptarSolicitud] Error:', error);
    throw error;
  }
}

/**
 * Rechaza una solicitud de partido
 */
export async function rechazarSolicitud(solicitudId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que el usuario sea el creador del partido
    const { data: solicitud } = await supabase
      .from('solicitudes_partidos')
      .select(`
        *,
        partido:partidos_abiertos(creador_id)
      `)
      .eq('id', solicitudId)
      .single();

    if (!solicitud || (solicitud.partido as any).creador_id !== user.id) {
      throw new Error('No tienes permiso para rechazar esta solicitud');
    }

    const { error } = await supabase
      .from('solicitudes_partidos')
      .update({ estado: 'rechazada' })
      .eq('id', solicitudId);

    if (error) throw error;

    // Enviar notificación al equipo solicitante
    try {
      const { data: equipoSolicitante } = await supabase
        .from('equipos')
        .select('nombre')
        .eq('id', (solicitud as any).equipo_solicitante_id)
        .single();

      if (equipoSolicitante) {
        await notifySolicitudRechazada(
          equipoSolicitante.nombre,
          (solicitud.partido as any).id
        );
      }
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }
  } catch (error: any) {
    console.error('❌ [rechazarSolicitud] Error:', error);
    throw error;
  }
}

/**
 * Cancela un partido abierto
 */
export async function cancelarPartidoAbierto(partidoId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('partidos_abiertos')
      .update({ estado: 'cancelado' })
      .eq('id', partidoId)
      .eq('creador_id', user.id);

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [cancelarPartidoAbierto] Error:', error);
    throw error;
  }
}

/**
 * Busca matches automáticos para un partido abierto
 * Retorna partidos compatibles (misma fecha/hora, similar número de jugadores)
 */
export async function buscarMatchAutomatico(
  partidoId: string
): Promise<PartidoAbiertoWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Obtener el partido actual
    const { data: partido, error: partidoError } = await supabase
      .from('partidos_abiertos')
      .select(`
        *,
        reserva:reservas(
          fecha_hora,
          cancha:canchas(
            jugadores_por_equipo
          )
        )
      `)
      .eq('id', partidoId)
      .eq('creador_id', user.id)
      .single();

    if (partidoError || !partido) {
      throw new Error('Partido no encontrado');
    }

    const reserva = partido.reserva as any;
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    const fechaHora = new Date(reserva.fecha_hora);
    const fechaInicio = new Date(fechaHora);
    fechaInicio.setHours(fechaInicio.getHours() - 1);
    const fechaFin = new Date(fechaHora);
    fechaFin.setHours(fechaFin.getHours() + 1);

    // Buscar partidos abiertos en la misma fecha/hora
    const { data: matches, error: matchesError } = await supabase
      .from('partidos_abiertos')
      .select(`
        *,
        reserva:reservas(
          fecha_hora,
          cancha:canchas(
            jugadores_por_equipo
          )
        ),
        equipo:equipos(
          id,
          nombre,
          logo_url
        )
      `)
      .eq('estado', 'abierto')
      .eq('busca_automatico', true)
      .neq('id', partidoId)
      .neq('creador_id', user.id)
      .gte('reservas.fecha_hora', fechaInicio.toISOString())
      .lte('reservas.fecha_hora', fechaFin.toISOString())
      .gte('jugadores_necesarios', (partido.jugadores_necesarios || 1) - 2)
      .lte('jugadores_necesarios', (partido.jugadores_necesarios || 1) + 2);

    if (matchesError) throw matchesError;

    return (matches || []) as PartidoAbiertoWithRelations[];
  } catch (error: any) {
    console.error('❌ [buscarMatchAutomatico] Error:', error);
    throw error;
  }
}

function parseHHmmToMinutes(s: string): number {
  const parts = s.trim().split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] || '0', 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10) || 0));
  return h * 60 + m;
}

/** Filtra partidos por hora local del inicio de la reserva (HH:mm 24h). */
export function filterPartidosPorRangoHorario(
  partidos: PartidoAbiertoWithRelations[],
  horaInicioHHmm: string,
  horaFinHHmm: string
): PartidoAbiertoWithRelations[] {
  let start = parseHHmmToMinutes(horaInicioHHmm);
  let end = parseHHmmToMinutes(horaFinHHmm);
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  return partidos.filter((p) => {
    const fh = (p.reserva as { fecha_hora?: string } | undefined)?.fecha_hora;
    if (!fh) return true;
    const d = new Date(fh);
    const mins = d.getHours() * 60 + d.getMinutes();
    return mins >= start && mins <= end;
  });
}
