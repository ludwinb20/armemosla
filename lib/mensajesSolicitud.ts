import { supabase } from './supabase';
import { dispatchNotification } from './push/dispatchNotification';

export interface MensajeSolicitudItem {
  id: string;
  solicitudId: string;
  senderId: string;
  senderNombre: string;
  body: string;
  createdAt: string;
  /** Mensaje inicial guardado en solicitudes_partidos.mensaje (no editable) */
  esMensajeInicial?: boolean;
}

export interface SolicitudConversacionContext {
  solicitudId: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';
  direccion: 'enviada' | 'recibida';
  miEquipoNombre: string;
  rivalEquipoNombre: string;
  rivalUsuarioNombre: string;
  reservaFechaHora?: string;
  canchaNombre?: string;
  complejoNombre?: string;
  mensajeInicial?: string | null;
  mensajeInicialAt?: string;
  mensajeInicialSenderId?: string;
  mensajeInicialSenderNombre?: string;
}

const PAGE_SIZE = 30;

type SolicitudContextRow = {
  id: string;
  estado: string;
  mensaje?: string | null;
  created_at: string;
  equipo_solicitante?: {
    id?: string;
    nombre?: string;
    creador?: { id?: string; full_name?: string | null } | null;
  } | null;
  partido?: {
    creador_id?: string;
    creador?: { id?: string; full_name?: string | null } | null;
    equipo?: { id?: string; nombre?: string } | null;
    reserva?: {
      fecha_hora?: string;
      cancha?: { nombre?: string; complejo?: { nombre?: string } | null } | null;
    } | null;
  } | null;
};

function mapContextRow(
  row: SolicitudContextRow,
  userId: string,
  equipoIds: Set<string>
): SolicitudConversacionContext {
  const partido = row.partido;
  const reserva = partido?.reserva;
  const cancha = reserva?.cancha;
  const equipoSolicitante = row.equipo_solicitante;
  const equipoAnfitrion = partido?.equipo;

  const esSolicitante =
    Boolean(equipoSolicitante?.id && equipoIds.has(equipoSolicitante.id)) &&
    partido?.creador_id !== userId;

  const direccion: 'enviada' | 'recibida' = esSolicitante ? 'enviada' : 'recibida';

  const miEquipoNombre =
    direccion === 'enviada'
      ? equipoSolicitante?.nombre || 'Mi equipo'
      : equipoAnfitrion?.nombre || 'Mi equipo';

  const rivalEquipoNombre =
    direccion === 'enviada'
      ? equipoAnfitrion?.nombre || 'Rival'
      : equipoSolicitante?.nombre || 'Rival';

  const rivalUsuarioNombre =
    direccion === 'enviada'
      ? partido?.creador?.full_name?.trim() || 'Jugador'
      : equipoSolicitante?.creador?.full_name?.trim() || 'Jugador';

  return {
    solicitudId: row.id,
    estado: row.estado as SolicitudConversacionContext['estado'],
    direccion,
    miEquipoNombre,
    rivalEquipoNombre,
    rivalUsuarioNombre,
    reservaFechaHora: reserva?.fecha_hora,
    canchaNombre: cancha?.nombre,
    complejoNombre: cancha?.complejo?.nombre,
    mensajeInicial: row.mensaje?.trim() || null,
    mensajeInicialAt: row.created_at,
    mensajeInicialSenderId: equipoSolicitante?.creador?.id,
    mensajeInicialSenderNombre: equipoSolicitante?.creador?.full_name?.trim() || 'Jugador',
  };
}

async function enrichContextWithProfileNames(row: SolicitudContextRow): Promise<SolicitudContextRow> {
  const ids = new Set<string>();
  const solicitanteCreadorId = row.equipo_solicitante?.creador?.id;
  const partidoCreadorId = row.partido?.creador?.id;

  if (solicitanteCreadorId) ids.add(solicitanteCreadorId);
  if (partidoCreadorId) ids.add(partidoCreadorId);

  if (ids.size === 0) return row;

  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', Array.from(ids));

  const nombres = new Map(
    (perfiles || []).map((p) => [p.id as string, (p.full_name as string | null) ?? null])
  );

  return {
    ...row,
    equipo_solicitante: row.equipo_solicitante
      ? {
          ...row.equipo_solicitante,
          creador: row.equipo_solicitante.creador
            ? {
                ...row.equipo_solicitante.creador,
                full_name: nombres.get(row.equipo_solicitante.creador.id || '') ?? null,
              }
            : row.equipo_solicitante.creador,
        }
      : row.equipo_solicitante,
    partido: row.partido
      ? {
          ...row.partido,
          creador: row.partido.creador
            ? {
                ...row.partido.creador,
                full_name: nombres.get(row.partido.creador.id || '') ?? null,
              }
            : row.partido.creador,
        }
      : row.partido,
  };
}

export async function obtenerContextoConversacionSolicitud(
  solicitudId: string
): Promise<SolicitudConversacionContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('solicitudes_partidos')
    .select(
      `
      id, estado, mensaje, created_at,
      equipo_solicitante:equipos(id, nombre, creador_id),
      partido:partidos_abiertos(
        creador_id,
        equipo:equipos(id, nombre),
        reserva:reservas(
          fecha_hora,
          cancha:canchas(nombre, complejo:complejos(nombre))
        )
      )
    `
    )
    .eq('id', solicitudId)
    .single();

  if (error || !data) {
    console.error('❌ [obtenerContextoConversacionSolicitud]', error);
    throw new Error('No se pudo cargar la conversación');
  }

  const raw = data as {
    id: string;
    estado: string;
    mensaje?: string | null;
    created_at: string;
    equipo_solicitante?: { id?: string; nombre?: string; creador_id?: string } | null;
    partido?: SolicitudContextRow['partido'];
  };

  const row: SolicitudContextRow = {
    id: raw.id,
    estado: raw.estado,
    mensaje: raw.mensaje,
    created_at: raw.created_at,
    equipo_solicitante: raw.equipo_solicitante
      ? {
          id: raw.equipo_solicitante.id,
          nombre: raw.equipo_solicitante.nombre,
          creador: raw.equipo_solicitante.creador_id
            ? { id: raw.equipo_solicitante.creador_id }
            : null,
        }
      : null,
    partido: raw.partido
      ? {
          ...raw.partido,
          creador: raw.partido.creador_id ? { id: raw.partido.creador_id } : null,
        }
      : null,
  };

  const [{ data: membresias }, enriched] = await Promise.all([
    supabase.from('jugador_equipos').select('equipo_id').eq('jugador_id', user.id),
    enrichContextWithProfileNames(row),
  ]);

  const equipoIds = new Set(
    (membresias || [])
      .map((m) => m.equipo_id as string)
      .filter((id): id is string => Boolean(id))
  );

  return mapContextRow(enriched, user.id, equipoIds);
}

export async function obtenerMensajesSolicitud(
  solicitudId: string,
  opts?: { before?: string; limit?: number }
): Promise<MensajeSolicitudItem[]> {
  const limit = opts?.limit ?? PAGE_SIZE;

  let query = supabase
    .from('mensajes_solicitud')
    .select('id, solicitud_id, sender_id, body, created_at')
    .eq('solicitud_id', solicitudId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts?.before) {
    query = query.lt('created_at', opts.before);
  }

  const { data, error } = await query;
  if (error) {
    // Tabla aún no migrada o sin permisos: permitir ver al menos el mensaje inicial
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ [obtenerMensajesSolicitud] Tabla mensajes_solicitud no disponible');
      return [];
    }
    console.error('❌ [obtenerMensajesSolicitud]', error);
    throw error;
  }

  const rows = data || [];
  if (rows.length === 0) return [];

  const senderIds = [...new Set(rows.map((r) => r.sender_id as string))];
  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', senderIds);

  const nombres = new Map(
    (perfiles || []).map((p) => [p.id as string, (p.full_name as string | null)?.trim() || 'Jugador'])
  );

  return rows.map((row) => ({
    id: row.id,
    solicitudId: row.solicitud_id,
    senderId: row.sender_id,
    senderNombre: nombres.get(row.sender_id) || 'Jugador',
    body: row.body,
    createdAt: row.created_at,
  }));
}

export function combinarMensajeInicialConHistorial(
  contexto: SolicitudConversacionContext,
  mensajesDesc: MensajeSolicitudItem[]
): MensajeSolicitudItem[] {
  const mensajesAsc = [...mensajesDesc].reverse();

  // Legacy: solicitudes anteriores a mensajes_solicitud (solo si el hilo está vacío)
  if (mensajesAsc.length === 0 && contexto.mensajeInicial) {
    return [
      {
        id: `inicial-${contexto.solicitudId}`,
        solicitudId: contexto.solicitudId,
        senderId: contexto.mensajeInicialSenderId || 'sistema',
        senderNombre: contexto.mensajeInicialSenderNombre || 'Jugador',
        body: contexto.mensajeInicial,
        createdAt: contexto.mensajeInicialAt || new Date().toISOString(),
        esMensajeInicial: true,
      },
    ];
  }

  return mensajesAsc;
}

/** Primer mensaje al crear una solicitud (hilo en mensajes_solicitud). */
export async function crearMensajeInicialParaSolicitud(
  solicitudId: string,
  body: string
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('mensajes_solicitud').insert({
    solicitud_id: solicitudId,
    sender_id: user.id,
    body: trimmed,
  });

  if (error) {
    console.warn('⚠️ [crearMensajeInicialParaSolicitud]', error);
  }
}

export async function enviarMensajeSolicitud(
  solicitudId: string,
  body: string
): Promise<MensajeSolicitudItem> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Escribe un mensaje');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('mensajes_solicitud')
    .insert({
      solicitud_id: solicitudId,
      sender_id: user.id,
      body: trimmed,
    })
    .select('id, solicitud_id, sender_id, body, created_at')
    .single();

  if (error || !data) {
    console.error('❌ [enviarMensajeSolicitud]', error);
    throw new Error('No se pudo enviar el mensaje');
  }

  const preview = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
  dispatchNotification('mensaje_solicitud', {
    solicitud_id: solicitudId,
    sender_id: user.id,
    preview,
  });

  const { data: perfil } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: data.id,
    solicitudId: data.solicitud_id,
    senderId: data.sender_id,
    senderNombre: perfil?.full_name?.trim() || 'Jugador',
    body: data.body,
    createdAt: data.created_at,
  };
}

export { PAGE_SIZE as MENSAJES_PAGE_SIZE };

export async function marcarSolicitudComoLeida(solicitudId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('solicitud_lecturas').upsert(
    {
      solicitud_id: solicitudId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'solicitud_id,user_id' }
  );

  if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
    console.warn('⚠️ [marcarSolicitudComoLeida]', error);
  }
}

type SolicitudParaNoLeidos = {
  id: string;
  mensaje?: string | null;
  created_at: string;
  direccion: 'enviada' | 'recibida';
};

export async function obtenerMensajesNoLeidosPorSolicitud(
  items: SolicitudParaNoLeidos[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (items.length === 0) return result;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return result;

  for (const item of items) {
    result[item.id] = 0;
  }

  const solicitudIds = items.map((i) => i.id);

  const [{ data: lecturas, error: errLecturas }, { data: mensajes, error: errMensajes }] =
    await Promise.all([
      supabase
        .from('solicitud_lecturas')
        .select('solicitud_id, last_read_at')
        .eq('user_id', user.id)
        .in('solicitud_id', solicitudIds),
      supabase
        .from('mensajes_solicitud')
        .select('solicitud_id, sender_id, created_at')
        .in('solicitud_id', solicitudIds)
        .neq('sender_id', user.id),
    ]);

  if (errLecturas && errLecturas.code !== '42P01' && errLecturas.code !== 'PGRST205') {
    console.warn('⚠️ [obtenerMensajesNoLeidosPorSolicitud] lecturas', errLecturas);
  }
  if (errMensajes && errMensajes.code !== '42P01' && errMensajes.code !== 'PGRST205') {
    console.warn('⚠️ [obtenerMensajesNoLeidosPorSolicitud] mensajes', errMensajes);
    return result;
  }

  const lastReadMap = new Map(
    (lecturas || []).map((l) => [l.solicitud_id as string, l.last_read_at as string])
  );

  const mensajesPorSolicitud = new Map<string, typeof mensajes>();
  for (const m of mensajes || []) {
    const sid = m.solicitud_id as string;
    const list = mensajesPorSolicitud.get(sid) || [];
    list.push(m);
    mensajesPorSolicitud.set(sid, list);
  }

  for (const item of items) {
    const lastRead = lastReadMap.get(item.id);
    const delOtro = mensajesPorSolicitud.get(item.id) || [];

    let count = delOtro.filter((m) => {
      if (!lastRead) return true;
      return new Date(m.created_at as string).getTime() > new Date(lastRead).getTime();
    }).length;

    // Legacy: mensaje en solicitudes_partidos sin filas en mensajes_solicitud
    if (count === 0 && delOtro.length === 0 && item.mensaje?.trim() && item.direccion === 'recibida') {
      if (!lastRead || new Date(item.created_at).getTime() > new Date(lastRead).getTime()) {
        count = 1;
      }
    }

    result[item.id] = count;
  }

  return result;
}
