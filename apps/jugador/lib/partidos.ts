import { supabase } from './supabase';
import { dispatchNotification } from './push/dispatchNotification';

const MENSAJE_SOLICITUD_DEFAULT = '¡Hola! Me interesa jugar este partido.';

function insertarMensajeInicialSolicitud(solicitudId: string, body: string, senderId: string) {
  void supabase
    .from('mensajes_solicitud')
    .insert({
      solicitud_id: solicitudId,
      sender_id: senderId,
      body,
    })
    .then(({ error }) => {
      if (error) {
        console.warn('⚠️ [insertarMensajeInicialSolicitud]', error);
      }
    });
}

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

export interface JugadorRetoCandidato {
  jugador_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  equipo_id?: string | null;
  equipo_nombre?: string | null;
  equipo_logo_url?: string | null;
  equipo_nombre_visible: string;
  complejos_en_comun: number;
  ya_invitado: boolean;
}

export interface RetoDirectoJugador {
  id: string;
  reserva_id: string;
  creador_id: string;
  jugador_objetivo_id: string;
  mensaje?: string | null;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado';
  created_at: string;
  updated_at: string;
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

    if (error) {
      if (error.code === '23505') {
        throw new Error('Esta reserva ya está publicada en la piscina.');
      }
      throw error;
    }
    if (!data) throw new Error('No se pudo crear el partido abierto');

    return data as PartidoAbierto;
  } catch (error: any) {
    console.error('❌ [crearPartidoAbierto] Error:', error);
    throw error;
  }
}

export interface PublicarReservaResult {
  partido: PartidoAbierto;
  matchesFound: number;
}

/**
 * Publica una reserva buscando rival (búsqueda automática siempre activa).
 */
export async function publicarReservaBuscarRival(
  reservaId: string,
  equipoId: string,
  jugadoresNecesarios: number
): Promise<PublicarReservaResult> {
  const partido = await crearPartidoAbierto(reservaId, equipoId, jugadoresNecesarios, true);
  let matchesFound = 0;
  try {
    const matches = await buscarMatchAutomatico(partido.id);
    matchesFound = matches.length;
    if (matchesFound > 0) {
      dispatchNotification('match_encontrado', {
        partido_id: partido.id,
        matches_count: String(matchesFound),
      });
    }
  } catch (error) {
    console.error('❌ [publicarReservaBuscarRival] match automático:', error);
  }
  return { partido, matchesFound };
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

    if (filtros?.jugadoresMin) {
      query = query.gte('jugadores_necesarios', filtros.jugadoresMin);
    }

    if (filtros?.jugadoresMax) {
      query = query.lte('jugadores_necesarios', filtros.jugadoresMax);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    let list = (data || []) as PartidoAbiertoWithRelations[];

    const ahora = Date.now();
    list = list.filter((p) => {
      const fh = p.reserva?.fecha_hora;
      if (!fh) return false;
      return new Date(fh).getTime() >= ahora - 60_000;
    });

    if (filtros?.fechaDesde) {
      const t = new Date(filtros.fechaDesde).getTime();
      list = list.filter((p) => new Date(p.reserva?.fecha_hora || 0).getTime() >= t);
    }
    if (filtros?.fechaHasta) {
      const t = new Date(filtros.fechaHasta).getTime();
      list = list.filter((p) => new Date(p.reserva?.fecha_hora || 0).getTime() <= t);
    }

    return list;
  } catch (error: any) {
    console.error('❌ [obtenerPartidosAbiertos] Error:', error);
    throw error;
  }
}

/**
 * Estados de partidos abiertos para un conjunto de reservas (consulta liviana).
 */
export async function obtenerEstadosPartidoPorReservas(
  reservaIds: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (reservaIds.length === 0) return map;

  const { data, error } = await supabase
    .from('partidos_abiertos')
    .select('reserva_id, estado')
    .in('reserva_id', reservaIds);

  if (error) {
    console.error('❌ [obtenerEstadosPartidoPorReservas] Error:', error);
    return map;
  }

  for (const row of data || []) {
    const rid = row.reserva_id as string | undefined;
    if (rid) {
      map[rid] = row.estado as string;
    }
  }
  return map;
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

    const cuerpoInicial = mensaje?.trim() || MENSAJE_SOLICITUD_DEFAULT;

    const { data, error } = await supabase
      .from('solicitudes_partidos')
      .insert({
        partido_id: partidoId,
        equipo_solicitante_id: equipoId,
        mensaje: cuerpoInicial,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42501') {
        throw new Error(
          'No tenés permiso para enviar este reto. Verificá que seas miembro del equipo y que el partido siga abierto.'
        );
      }
      if (error.code === '23505') {
        throw new Error('Ya enviaste un reto a este partido con ese equipo.');
      }
      throw error;
    }
    if (!data) throw new Error('No se pudo enviar la solicitud');

    insertarMensajeInicialSolicitud(data.id, cuerpoInicial, user.id);

    dispatchNotification('solicitud_partido_nueva', { solicitud_id: data.id });

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

    const partidoId = (solicitud.partido as any).id as string;

    const { data: otrasPendientes } = await supabase
      .from('solicitudes_partidos')
      .select('id')
      .eq('partido_id', partidoId)
      .neq('id', solicitudId)
      .eq('estado', 'pendiente');

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

    // Cierra la publicación en la piscina: el partido deja de estar "abierto".
    await supabase
      .from('partidos_abiertos')
      .update({ estado: 'confirmado' })
      .eq('id', partidoId);

    dispatchNotification('solicitud_aceptada', { solicitud_id: solicitudId });
    for (const otra of otrasPendientes ?? []) {
      dispatchNotification('solicitud_rechazada', { solicitud_id: otra.id });
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

    dispatchNotification('solicitud_rechazada', { solicitud_id: solicitudId });

  } catch (error: any) {
    console.error('❌ [rechazarSolicitud] Error:', error);
    throw error;
  }
}

/**
 * Cancela un partido abierto
 */
/** Quita la publicación de la piscina; permite volver a publicar la misma reserva (UNIQUE por reserva_id). */
export async function cancelarPartidoAbierto(partidoId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('partidos_abiertos')
      .delete()
      .eq('id', partidoId)
      .eq('creador_id', user.id);

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [cancelarPartidoAbierto] Error:', error);
    throw error;
  }
}

/**
 * Busca rivales compatibles en la piscina (misma franja horaria, jugadores similares).
 * Prioriza publicaciones con búsqueda automática activada.
 */
export async function buscarMatchAutomatico(
  partidoId: string
): Promise<PartidoAbiertoWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: partido, error: partidoError } = await supabase
      .from('partidos_abiertos')
      .select(`
        *,
        reserva:reservas(fecha_hora)
      `)
      .eq('id', partidoId)
      .eq('creador_id', user.id)
      .single();

    if (partidoError || !partido) {
      throw new Error('Partido no encontrado');
    }

    const reserva = partido.reserva as { fecha_hora?: string } | undefined;
    if (!reserva?.fecha_hora) {
      throw new Error('Reserva no encontrada');
    }

    const fechaHoraMs = new Date(reserva.fecha_hora).getTime();
    const ventanaMs = 60 * 60 * 1000;
    const jugadoresObjetivo = partido.jugadores_necesarios || 5;

    const { data: candidatos, error: matchesError } = await supabase
      .from('partidos_abiertos')
      .select(`
        *,
        reserva:reservas(fecha_hora),
        equipo:equipos(id, nombre, logo_url)
      `)
      .eq('estado', 'abierto')
      .neq('id', partidoId)
      .neq('creador_id', user.id);

    if (matchesError) throw matchesError;

    const compatibles = (candidatos || [])
      .filter((c) => {
        const fh = (c.reserva as { fecha_hora?: string } | undefined)?.fecha_hora;
        if (!fh) return false;
        const diff = Math.abs(new Date(fh).getTime() - fechaHoraMs);
        if (diff > ventanaMs) return false;
        const j = c.jugadores_necesarios || 0;
        return Math.abs(j - jugadoresObjetivo) <= 2;
      })
      .sort((a, b) => {
        const aAuto = a.busca_automatico ? 1 : 0;
        const bAuto = b.busca_automatico ? 1 : 0;
        if (bAuto !== aAuto) return bAuto - aAuto;
        const aFh = new Date((a.reserva as { fecha_hora: string }).fecha_hora).getTime();
        const bFh = new Date((b.reserva as { fecha_hora: string }).fecha_hora).getTime();
        return Math.abs(aFh - fechaHoraMs) - Math.abs(bFh - fechaHoraMs);
      });

    return compatibles as PartidoAbiertoWithRelations[];
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

/**
 * Lista jugadores candidatos para ofrecer un reto directo.
 * Orden: más complejos en común primero. Paginación por limit/offset.
 */
export async function listarJugadoresParaReto(
  reservaId: string,
  limit: number = 15,
  offset: number = 0
): Promise<JugadorRetoCandidato[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase.rpc('listar_jugadores_para_reto', {
      p_reserva_id: reservaId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw error;
    }

    const rows = (data || []) as any[];
    return rows.map((r) => ({
      jugador_id: String(r.jugador_id),
      full_name: r.full_name ?? null,
      avatar_url: r.avatar_url ?? null,
      equipo_id: r.equipo_id ?? null,
      equipo_nombre: r.equipo_nombre ?? null,
      equipo_logo_url: r.equipo_logo_url ?? null,
      equipo_nombre_visible:
        r.equipo_nombre_visible ||
        `Equipo de ${r.full_name || 'Jugador'}`,
      complejos_en_comun: Number(r.complejos_en_comun || 0),
      ya_invitado: Boolean(r.ya_invitado),
    }));
  } catch (error: any) {
    console.error('❌ [listarJugadoresParaReto] Error:', error);
    if (error?.code === 'PGRST202') {
      throw new Error(
        'Falta ejecutar la migración SQL de retos directos (función listar_jugadores_para_reto).'
      );
    }
    throw error;
  }
}

/**
 * Crea (o reactiva) una oferta de reto directo para un jugador.
 */
export interface SolicitudRetoPiscinaItem {
  id: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';
  mensaje?: string | null;
  created_at: string;
  direccion: 'enviada' | 'recibida';
  equipoSolicitanteNombre: string;
  equipoAnfitrionNombre?: string;
  partidoId: string;
  reservaId?: string;
  reservaFechaHora?: string;
  canchaNombre?: string;
  complejoNombre?: string;
}

export interface RetoDirectoItem {
  id: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado';
  mensaje?: string | null;
  created_at: string;
  direccion: 'enviado' | 'recibido';
  contrincanteNombre: string;
  reservaId: string;
  reservaFechaHora?: string;
  canchaNombre?: string;
  complejoNombre?: string;
}

type PartidoSolicitudRow = {
  id: string;
  estado: string;
  mensaje?: string | null;
  created_at: string;
  equipo_solicitante?: { nombre?: string } | null;
  partido?: {
    id: string;
    equipo?: { nombre?: string } | null;
    reserva?: {
      id: string;
      fecha_hora?: string;
      cancha?: { nombre?: string; complejo?: { nombre?: string } | null } | null;
    } | null;
  } | null;
};

function mapSolicitudPiscina(
  row: PartidoSolicitudRow,
  direccion: 'enviada' | 'recibida',
  equipoAnfitrionNombre?: string
): SolicitudRetoPiscinaItem {
  const partido = row.partido;
  const reserva = partido?.reserva;
  const cancha = reserva?.cancha;
  return {
    id: row.id,
    estado: row.estado as SolicitudRetoPiscinaItem['estado'],
    mensaje: row.mensaje,
    created_at: row.created_at,
    direccion,
    equipoSolicitanteNombre: row.equipo_solicitante?.nombre || 'Equipo',
    equipoAnfitrionNombre,
    partidoId: partido?.id || '',
    reservaId: reserva?.id,
    reservaFechaHora: reserva?.fecha_hora,
    canchaNombre: cancha?.nombre,
    complejoNombre: cancha?.complejo?.nombre,
  };
}

/**
 * Solicitudes de reto en la piscina (enviadas por mis equipos y recibidas en mis publicaciones).
 */
export async function obtenerSolicitudesRetoPiscinaJugador(): Promise<SolicitudRetoPiscinaItem[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const items: SolicitudRetoPiscinaItem[] = [];

    const { data: membresias } = await supabase
      .from('jugador_equipos')
      .select('equipo_id')
      .eq('jugador_id', user.id);

    const equipoIds = (membresias || [])
      .map((m) => m.equipo_id as string)
      .filter((id): id is string => Boolean(id));

    if (equipoIds.length > 0) {
      const { data: enviadas, error: errEnv } = await supabase
        .from('solicitudes_partidos')
        .select(
          `
          id, estado, mensaje, created_at,
          equipo_solicitante:equipos(nombre),
          partido:partidos_abiertos(
            id,
            equipo:equipos(nombre),
            reserva:reservas(
              id, fecha_hora,
              cancha:canchas(nombre, complejo:complejos(nombre))
            )
          )
        `
        )
        .in('equipo_solicitante_id', equipoIds)
        .order('created_at', { ascending: false });

      if (errEnv) throw errEnv;
      for (const row of (enviadas || []) as PartidoSolicitudRow[]) {
        items.push(
          mapSolicitudPiscina(row, 'enviada', row.partido?.equipo?.nombre || undefined)
        );
      }
    }

    const { data: misPartidos, error: errRec } = await supabase
      .from('partidos_abiertos')
      .select(
        `
        id,
        equipo:equipos(nombre),
        reserva:reservas(
          id, fecha_hora,
          cancha:canchas(nombre, complejo:complejos(nombre))
        ),
        solicitudes:solicitudes_partidos(
          id, estado, mensaje, created_at,
          equipo_solicitante:equipos(nombre)
        )
      `
      )
      .eq('creador_id', user.id);

    if (errRec) throw errRec;

    for (const partido of misPartidos || []) {
      const anfitrion = (partido as { equipo?: { nombre?: string } }).equipo?.nombre;
      const solicitudes = (partido as { solicitudes?: PartidoSolicitudRow[] }).solicitudes || [];
      for (const sol of solicitudes) {
        items.push(
          mapSolicitudPiscina(
            {
              ...sol,
              partido: {
                id: partido.id,
                equipo: (partido as { equipo?: { nombre?: string } }).equipo,
                reserva: (partido as { reserva?: PartidoSolicitudRow['partido'] }).reserva,
              },
            },
            'recibida',
            anfitrion
          )
        );
      }
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  } catch (error: any) {
    console.error('❌ [obtenerSolicitudesRetoPiscinaJugador] Error:', error);
    throw error;
  }
}

/**
 * Retos directos jugador (enviados y recibidos).
 */
export async function obtenerRetosDirectosJugador(): Promise<RetoDirectoItem[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('retos_directos_jugador')
      .select(
        `
        id, estado, mensaje, created_at, reserva_id, creador_id, jugador_objetivo_id,
        reserva:reservas(
          fecha_hora,
          cancha:canchas(nombre, complejo:complejos(nombre))
        ),
        creador:profiles!retos_directos_jugador_creador_id_fkey(full_name),
        objetivo:profiles!retos_directos_jugador_jugador_objetivo_id_fkey(full_name)
      `
      )
      .or(`creador_id.eq.${user.id},jugador_objetivo_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row) => {
      const soyCreador = row.creador_id === user.id;
      const reserva = row.reserva as {
        fecha_hora?: string;
        cancha?: { nombre?: string; complejo?: { nombre?: string } };
      } | null;
      const creador = row.creador as { full_name?: string | null } | null;
      const objetivo = row.objetivo as { full_name?: string | null } | null;
      return {
        id: row.id,
        estado: row.estado as RetoDirectoItem['estado'],
        mensaje: row.mensaje,
        created_at: row.created_at,
        direccion: soyCreador ? 'enviado' : 'recibido',
        contrincanteNombre: soyCreador
          ? objetivo?.full_name || 'Jugador'
          : creador?.full_name || 'Jugador',
        reservaId: row.reserva_id,
        reservaFechaHora: reserva?.fecha_hora,
        canchaNombre: reserva?.cancha?.nombre,
        complejoNombre: reserva?.cancha?.complejo?.nombre,
      };
    });
  } catch (error: any) {
    console.error('❌ [obtenerRetosDirectosJugador] Error:', error);
    throw error;
  }
}

export async function crearRetoDirectoJugador(
  reservaId: string,
  jugadorObjetivoId: string,
  mensaje?: string
): Promise<RetoDirectoJugador> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase.rpc('crear_reto_directo_jugador', {
      p_reserva_id: reservaId,
      p_jugador_objetivo_id: jugadorObjetivoId,
      p_mensaje: mensaje ?? null,
    });

    if (error) throw error;
    if (!data) throw new Error('No se pudo crear la oferta de reto');

    const reto = data as RetoDirectoJugador;
    dispatchNotification('reto_directo_nuevo', { reto_id: reto.id });

    return reto;
  } catch (error: any) {
    console.error('❌ [crearRetoDirectoJugador] Error:', error);
    if (error?.code === 'PGRST202') {
      throw new Error(
        'Falta ejecutar la migración SQL de retos directos (función crear_reto_directo_jugador).'
      );
    }
    throw error;
  }
}

export async function aceptarRetoDirectoJugador(retoId: string): Promise<RetoDirectoJugador> {
  const { data, error } = await supabase.rpc('aceptar_reto_directo_jugador', {
    p_reto_id: retoId,
  });
  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error('Falta ejecutar db_settings/55_retos_directos_respuesta.sql en Supabase.');
    }
    throw error;
  }
  if (!data) throw new Error('No se pudo aceptar el reto');

  dispatchNotification('reto_directo_respuesta', { reto_id: retoId, estado: 'aceptado' });
  return data as RetoDirectoJugador;
}

export async function rechazarRetoDirectoJugador(retoId: string): Promise<RetoDirectoJugador> {
  const { data, error } = await supabase.rpc('rechazar_reto_directo_jugador', {
    p_reto_id: retoId,
  });
  if (error) throw error;
  if (!data) throw new Error('No se pudo rechazar el reto');

  dispatchNotification('reto_directo_respuesta', { reto_id: retoId, estado: 'rechazado' });
  return data as RetoDirectoJugador;
}

export async function cancelarRetoDirectoJugador(retoId: string): Promise<RetoDirectoJugador> {
  const { data, error } = await supabase.rpc('cancelar_reto_directo_jugador', {
    p_reto_id: retoId,
  });
  if (error) throw error;
  if (!data) throw new Error('No se pudo cancelar el reto');

  dispatchNotification('reto_directo_respuesta', { reto_id: retoId, estado: 'cancelado' });
  return data as RetoDirectoJugador;
}
