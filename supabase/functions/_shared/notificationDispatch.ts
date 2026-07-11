import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  fetchEquipoMemberIds,
  fetchPlatformAdminIds,
  formatFechaHoraHN,
  formatMontoLempiras,
  formatProfileLabel,
  sendToUsers,
} from './expoPush.ts';

export type NotificationPayload = Record<string, string | undefined>;

export interface DispatchResult {
  ok: boolean;
  sent: number;
  error?: string;
}

async function profileLabel(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .maybeSingle();
  return formatProfileLabel(data);
}

async function reservaContext(
  supabase: SupabaseClient,
  reservaId: string
): Promise<{
  reserva: {
    id: string;
    user_id: string | null;
    made_by_player: boolean;
    fecha_hora: string;
    cancha_id: string;
  };
  canchaNombre: string;
  complejoNombre: string;
  adminId: string;
} | null> {
  const { data: reserva } = await supabase
    .from('reservas')
    .select('id, user_id, made_by_player, fecha_hora, cancha_id')
    .eq('id', reservaId)
    .maybeSingle();

  if (!reserva) return null;

  const { data: cancha } = await supabase
    .from('canchas')
    .select('nombre, complejo:complejos(nombre, admin_id)')
    .eq('id', reserva.cancha_id)
    .maybeSingle();

  const complejo = cancha?.complejo as { nombre?: string; admin_id?: string } | null;
  if (!complejo?.admin_id) return null;

  return {
    reserva: reserva as {
      id: string;
      user_id: string | null;
      made_by_player: boolean;
      fecha_hora: string;
      cancha_id: string;
    },
    canchaNombre: cancha?.nombre ?? 'Cancha',
    complejoNombre: complejo.nombre ?? 'Complejo',
    adminId: complejo.admin_id,
  };
}

export async function dispatchNotification(
  supabase: SupabaseClient,
  type: string,
  payload: NotificationPayload
): Promise<DispatchResult> {
  try {
    switch (type) {
      case 'pago_pendiente':
        return handlePagoPendiente(supabase, payload);
      case 'solicitud_reembolso_nueva':
        return handleSolicitudReembolsoNueva(supabase, payload);
      case 'pago_confirmado':
        return handlePagoConfirmado(supabase, payload);
      case 'pago_rechazado':
        return handlePagoRechazado(supabase, payload);
      case 'factura_pagada':
        return handleFacturaPagada(supabase, payload);
      case 'reembolso_aprobado':
        return handleReembolsoAprobado(supabase, payload);
      case 'reembolso_rechazado':
        return handleReembolsoRechazado(supabase, payload);
      case 'reembolso_directo':
        return handleReembolsoDirecto(supabase, payload);
      case 'pago_tarjeta_ok':
        return handlePagoTarjetaOk(supabase, payload);
      case 'reserva_nueva':
        return handleReservaNueva(supabase, payload);
      case 'reserva_cancelada':
        return handleReservaCancelada(supabase, payload);
      case 'reserva_cancelada_admin':
        return handleReservaCanceladaAdmin(supabase, payload);
      case 'solicitud_partido_nueva':
        return handleSolicitudPartidoNueva(supabase, payload);
      case 'solicitud_aceptada':
        return handleSolicitudAceptada(supabase, payload);
      case 'solicitud_rechazada':
        return handleSolicitudRechazada(supabase, payload);
      case 'mensaje_solicitud':
        return handleMensajeSolicitud(supabase, payload);
      case 'reto_directo_nuevo':
        return handleRetoDirectoNuevo(supabase, payload);
      case 'reto_directo_respuesta':
        return handleRetoDirectoRespuesta(supabase, payload);
      case 'match_encontrado':
        return handleMatchEncontrado(supabase, payload);
      case 'logro_desbloqueado':
        return handleLogroDesbloqueado(supabase, payload);
      case 'recompensa_canjeada':
        return handleRecompensaCanjeada(supabase, payload);
      case 'factura_retrasada':
        return handleFacturaRetrasada(supabase, payload);
      case 'factura_nueva':
        return handleFacturaNueva(supabase, payload);
      case 'factura_por_vencer':
        return handleFacturaPorVencer(supabase, payload);
      case 'complejos_ocultos':
        return handleComplejosOcultos(supabase, payload);
      case 'recordatorio_reserva':
        return handleRecordatorioReserva(supabase, payload);
      case 'recordatorio_partido':
        return handleRecordatorioPartido(supabase, payload);
      case 'revision_pendiente_digest':
        return handleRevisionPendienteDigest(supabase, payload);
      case 'send_direct':
        return handleSendDirect(supabase, payload);
      default:
        return { ok: false, sent: 0, error: `Tipo desconocido: ${type}` };
    }
  } catch (error) {
    console.error(`[dispatchNotification] ${type}:`, error);
    return {
      ok: false,
      sent: 0,
      error: error instanceof Error ? error.message : 'Error',
    };
  }
}

async function handleSendDirect(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const userIds = (payload.user_ids ?? '').split(',').filter(Boolean);
  const title = payload.title ?? 'Armemosla';
  const body = payload.body ?? '';
  const data: Record<string, string> = { type: payload.event_type ?? 'direct' };
  if (payload.data_json) {
    try {
      Object.assign(data, JSON.parse(payload.data_json));
    } catch {
      /* ignore */
    }
  }
  const sent = await sendToUsers(supabase, userIds, title, body, data);
  return { ok: true, sent };
}

async function handlePagoPendiente(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const transferenciaId = payload.transferencia_id;
  if (!transferenciaId) return { ok: false, sent: 0, error: 'transferencia_id requerido' };

  const { data: transferencia } = await supabase
    .from('transferencias')
    .select('admin_id, monto')
    .eq('id', transferenciaId)
    .maybeSingle();

  let bodyText = 'Nuevo pago pendiente de revisión';
  if (transferencia) {
    const label = await profileLabel(supabase, transferencia.admin_id);
    bodyText = `Nuevo pago pendiente — ${label} · ${formatMontoLempiras(transferencia.monto)}`;
  }

  const adminIds = await fetchPlatformAdminIds(supabase);
  const sent = await sendToUsers(supabase, adminIds, 'Pago pendiente de revisión', bodyText, {
    type: 'pago_pendiente',
    transferencia_id: transferenciaId,
  });
  return { ok: true, sent };
}

async function handleSolicitudReembolsoNueva(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_reembolso_id;
  if (!solicitudId) return { ok: false, sent: 0, error: 'solicitud_reembolso_id requerido' };

  const { data: solicitud } = await supabase
    .from('solicitudes_reembolso')
    .select('admin_id, monto, transferencia_id')
    .eq('id', solicitudId)
    .maybeSingle();

  let bodyText = 'Nueva solicitud de reembolso';
  if (solicitud) {
    const label = await profileLabel(supabase, solicitud.admin_id);
    bodyText = `Nueva solicitud — ${label} · ${formatMontoLempiras(solicitud.monto)}`;
  }

  const adminIds = await fetchPlatformAdminIds(supabase);
  const sent = await sendToUsers(supabase, adminIds, 'Solicitud de reembolso', bodyText, {
    type: 'solicitud_reembolso_nueva',
    solicitud_reembolso_id: solicitudId,
    transferencia_id: solicitud?.transferencia_id ?? '',
  });
  return { ok: true, sent };
}

async function handlePagoConfirmado(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const transferenciaId = payload.transferencia_id;
  if (!transferenciaId) return { ok: false, sent: 0, error: 'transferencia_id requerido' };

  const { data: transferencia } = await supabase
    .from('transferencias')
    .select('admin_id, monto')
    .eq('id', transferenciaId)
    .maybeSingle();
  if (!transferencia) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    [transferencia.admin_id],
    'Pago confirmado',
    `Tu transferencia de ${formatMontoLempiras(transferencia.monto)} fue confirmada.`,
    { type: 'pago_confirmado', transferencia_id: transferenciaId }
  );
  return { ok: true, sent };
}

async function handlePagoRechazado(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const transferenciaId = payload.transferencia_id;
  if (!transferenciaId) return { ok: false, sent: 0, error: 'transferencia_id requerido' };

  const { data: transferencia } = await supabase
    .from('transferencias')
    .select('admin_id, monto, notas_admin')
    .eq('id', transferenciaId)
    .maybeSingle();
  if (!transferencia) return { ok: true, sent: 0 };

  const motivo = transferencia.notas_admin?.trim();
  const body = motivo
    ? `Tu pago de ${formatMontoLempiras(transferencia.monto)} fue rechazado: ${motivo}`
    : `Tu pago de ${formatMontoLempiras(transferencia.monto)} fue rechazado.`;

  const sent = await sendToUsers(supabase, [transferencia.admin_id], 'Pago rechazado', body, {
    type: 'pago_rechazado',
    transferencia_id: transferenciaId,
  });
  return { ok: true, sent };
}

async function handleFacturaPagada(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const facturaId = payload.factura_id;
  if (!facturaId) return { ok: false, sent: 0, error: 'factura_id requerido' };

  const { data: factura } = await supabase
    .from('facturas_mensuales')
    .select('admin_id, mes, año')
    .eq('id', facturaId)
    .maybeSingle();
  if (!factura) return { ok: true, sent: 0 };

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const periodo = `${MESES[(factura.mes as number) - 1] ?? factura.mes} ${factura.año}`;

  const sent = await sendToUsers(
    supabase,
    [factura.admin_id as string],
    'Factura pagada',
    `Tu factura de ${periodo} quedó pagada.`,
    { type: 'factura_pagada', factura_id: facturaId }
  );
  return { ok: true, sent };
}

async function handleReembolsoAprobado(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_reembolso_id;
  if (!solicitudId) return { ok: false, sent: 0, error: 'solicitud_reembolso_id requerido' };

  const { data: solicitud } = await supabase
    .from('solicitudes_reembolso')
    .select('admin_id, monto, transferencia_id')
    .eq('id', solicitudId)
    .maybeSingle();
  if (!solicitud) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    [solicitud.admin_id],
    'Reembolso aprobado',
    `Tu solicitud de reembolso por ${formatMontoLempiras(solicitud.monto)} fue aprobada.`,
    {
      type: 'reembolso_aprobado',
      solicitud_reembolso_id: solicitudId,
      transferencia_id: solicitud.transferencia_id,
    }
  );
  return { ok: true, sent };
}

async function handleReembolsoRechazado(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_reembolso_id;
  if (!solicitudId) return { ok: false, sent: 0, error: 'solicitud_reembolso_id requerido' };

  const { data: solicitud } = await supabase
    .from('solicitudes_reembolso')
    .select('admin_id, monto, respuesta_plataforma, transferencia_id')
    .eq('id', solicitudId)
    .maybeSingle();
  if (!solicitud) return { ok: true, sent: 0 };

  const respuesta = solicitud.respuesta_plataforma?.trim();
  const body = respuesta
    ? `Tu solicitud de reembolso fue rechazada: ${respuesta}`
    : 'Tu solicitud de reembolso fue rechazada.';

  const sent = await sendToUsers(supabase, [solicitud.admin_id], 'Reembolso rechazado', body, {
    type: 'reembolso_rechazado',
    solicitud_reembolso_id: solicitudId,
    transferencia_id: solicitud.transferencia_id,
  });
  return { ok: true, sent };
}

async function handleReembolsoDirecto(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const transferenciaId = payload.transferencia_id;
  if (!transferenciaId) return { ok: false, sent: 0, error: 'transferencia_id requerido' };

  const { data: transferencia } = await supabase
    .from('transferencias')
    .select('admin_id, monto')
    .eq('id', transferenciaId)
    .maybeSingle();
  if (!transferencia) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    [transferencia.admin_id],
    'Reembolso registrado',
    `Armemosla registró un reembolso de ${formatMontoLempiras(transferencia.monto)} en tu cuenta.`,
    { type: 'reembolso_directo', transferencia_id: transferenciaId }
  );
  return { ok: true, sent };
}

async function handlePagoTarjetaOk(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const facturaId = payload.factura_id;
  if (!facturaId) return { ok: false, sent: 0, error: 'factura_id requerido' };

  const { data: factura } = await supabase
    .from('facturas_mensuales')
    .select('admin_id')
    .eq('id', facturaId)
    .maybeSingle();
  if (!factura) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    [factura.admin_id as string],
    'Pago con tarjeta confirmado',
    'Tu pago con tarjeta fue procesado correctamente.',
    { type: 'pago_tarjeta_ok', factura_id: facturaId }
  );
  return { ok: true, sent };
}

async function handleReservaNueva(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const reservaId = payload.reserva_id;
  if (!reservaId) return { ok: false, sent: 0, error: 'reserva_id requerido' };

  const ctx = await reservaContext(supabase, reservaId);
  if (!ctx || !ctx.reserva.made_by_player) return { ok: true, sent: 0 };

  const jugadorLabel = ctx.reserva.user_id
    ? await profileLabel(supabase, ctx.reserva.user_id)
    : 'Un jugador';

  const sent = await sendToUsers(
    supabase,
    [ctx.adminId],
    'Nueva reserva',
    `${jugadorLabel} reservó ${ctx.canchaNombre} · ${formatFechaHoraHN(ctx.reserva.fecha_hora)}`,
    { type: 'reserva_nueva', reserva_id: reservaId }
  );
  return { ok: true, sent };
}

async function handleReservaCancelada(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const reservaId = payload.reserva_id;
  if (!reservaId) return { ok: false, sent: 0, error: 'reserva_id requerido' };

  const ctx = await reservaContext(supabase, reservaId);
  if (!ctx || !ctx.reserva.made_by_player) return { ok: true, sent: 0 };

  const jugadorLabel = ctx.reserva.user_id
    ? await profileLabel(supabase, ctx.reserva.user_id)
    : 'Un jugador';

  const sent = await sendToUsers(
    supabase,
    [ctx.adminId],
    'Reserva cancelada',
    `${jugadorLabel} canceló ${ctx.canchaNombre} · ${formatFechaHoraHN(ctx.reserva.fecha_hora)}`,
    { type: 'reserva_cancelada', reserva_id: reservaId }
  );
  return { ok: true, sent };
}

async function handleReservaCanceladaAdmin(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const reservaId = payload.reserva_id;
  if (!reservaId) return { ok: false, sent: 0, error: 'reserva_id requerido' };

  const ctx = await reservaContext(supabase, reservaId);
  if (!ctx || !ctx.reserva.made_by_player || !ctx.reserva.user_id) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    [ctx.reserva.user_id],
    'Reserva cancelada',
    `El complejo canceló tu reserva en ${ctx.canchaNombre} · ${formatFechaHoraHN(ctx.reserva.fecha_hora)}`,
    { type: 'reserva_cancelada_admin', reserva_id: reservaId }
  );
  return { ok: true, sent };
}

async function handleSolicitudPartidoNueva(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_id;
  if (!solicitudId) return { ok: false, sent: 0, error: 'solicitud_id requerido' };

  const { data: solicitud } = await supabase
    .from('solicitudes_partidos')
    .select(`
      id, partido_id,
      equipo_solicitante:equipos(nombre),
      partido:partidos_abiertos(creador_id)
    `)
    .eq('id', solicitudId)
    .maybeSingle();

  const partido = solicitud?.partido as { creador_id?: string } | null;
  const equipo = solicitud?.equipo_solicitante as { nombre?: string } | null;
  if (!partido?.creador_id) return { ok: true, sent: 0 };

  const equipoNombre = equipo?.nombre ?? 'Un equipo';
  const sent = await sendToUsers(
    supabase,
    [partido.creador_id],
    'Nueva solicitud de partido',
    `${equipoNombre} quiere jugar contigo`,
    {
      type: 'solicitud_partido_nueva',
      solicitud_id: solicitudId,
      partido_id: solicitud?.partido_id ?? '',
    }
  );
  return { ok: true, sent };
}

async function handleSolicitudAceptada(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_id;
  if (!solicitudId) return { ok: false, sent: 0, error: 'solicitud_id requerido' };

  const { data: solicitud } = await supabase
    .from('solicitudes_partidos')
    .select(`
      id, equipo_solicitante_id,
      partido:partidos_abiertos(equipo:equipos(nombre))
    `)
    .eq('id', solicitudId)
    .maybeSingle();

  if (!solicitud?.equipo_solicitante_id) return { ok: true, sent: 0 };

  const partido = solicitud.partido as { equipo?: { nombre?: string } } | null;
  const rivalNombre = partido?.equipo?.nombre ?? 'tu rival';
  const memberIds = await fetchEquipoMemberIds(supabase, solicitud.equipo_solicitante_id);

  const sent = await sendToUsers(
    supabase,
    memberIds,
    'Solicitud aceptada',
    `Tu solicitud para jugar contra ${rivalNombre} fue aceptada`,
    { type: 'solicitud_aceptada', solicitud_id: solicitudId }
  );
  return { ok: true, sent };
}

async function handleSolicitudRechazada(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_id;
  if (!solicitudId) return { ok: false, sent: 0, error: 'solicitud_id requerido' };

  const { data: solicitud } = await supabase
    .from('solicitudes_partidos')
    .select(`
      id, equipo_solicitante_id,
      partido:partidos_abiertos(equipo:equipos(nombre))
    `)
    .eq('id', solicitudId)
    .maybeSingle();

  if (!solicitud?.equipo_solicitante_id) return { ok: true, sent: 0 };

  const partido = solicitud.partido as { equipo?: { nombre?: string } } | null;
  const rivalNombre = partido?.equipo?.nombre ?? 'el rival';
  const memberIds = await fetchEquipoMemberIds(supabase, solicitud.equipo_solicitante_id);

  const sent = await sendToUsers(
    supabase,
    memberIds,
    'Solicitud rechazada',
    `Tu solicitud para jugar contra ${rivalNombre} fue rechazada`,
    { type: 'solicitud_rechazada', solicitud_id: solicitudId }
  );
  return { ok: true, sent };
}

async function handleMensajeSolicitud(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const solicitudId = payload.solicitud_id;
  const senderId = payload.sender_id;
  if (!solicitudId || !senderId) {
    return { ok: false, sent: 0, error: 'solicitud_id y sender_id requeridos' };
  }

  const { data: solicitud } = await supabase
    .from('solicitudes_partidos')
    .select(`
      id,
      equipo_solicitante_id,
      partido:partidos_abiertos(creador_id)
    `)
    .eq('id', solicitudId)
    .maybeSingle();

  if (!solicitud) return { ok: true, sent: 0 };

  const partido = solicitud.partido as { creador_id?: string } | null;
  const recipientIds: string[] = [];

  if (partido?.creador_id && partido.creador_id !== senderId) {
    recipientIds.push(partido.creador_id);
  }

  if (solicitud.equipo_solicitante_id) {
    const members = await fetchEquipoMemberIds(supabase, solicitud.equipo_solicitante_id);
    for (const id of members) {
      if (id !== senderId && !recipientIds.includes(id)) recipientIds.push(id);
    }
  }

  const senderLabel = await profileLabel(supabase, senderId);
  const preview = payload.preview?.trim() || 'Nuevo mensaje';

  const sent = await sendToUsers(
    supabase,
    recipientIds,
    'Nuevo mensaje',
    `${senderLabel}: ${preview}`,
    { type: 'mensaje_solicitud', solicitud_id: solicitudId }
  );
  return { ok: true, sent };
}

async function handleRetoDirectoNuevo(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const retoId = payload.reto_id;
  if (!retoId) return { ok: false, sent: 0, error: 'reto_id requerido' };

  const { data: reto } = await supabase
    .from('retos_directos_jugador')
    .select(`
      id, jugador_objetivo_id, reserva_id,
      creador:profiles!retos_directos_jugador_creador_id_fkey(full_name, email)
    `)
    .eq('id', retoId)
    .maybeSingle();

  if (!reto?.jugador_objetivo_id) return { ok: true, sent: 0 };

  const creador = reto.creador as { full_name?: string; email?: string } | null;
  const label = formatProfileLabel(creador);

  const sent = await sendToUsers(
    supabase,
    [reto.jugador_objetivo_id],
    'Reto directo',
    `${label} te invitó a un partido`,
    { type: 'reto_directo_nuevo', reto_id: retoId, reserva_id: reto.reserva_id ?? '' }
  );
  return { ok: true, sent };
}

async function handleRetoDirectoRespuesta(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const retoId = payload.reto_id;
  const estado = payload.estado ?? 'actualizado';
  if (!retoId) return { ok: false, sent: 0, error: 'reto_id requerido' };

  const { data: reto } = await supabase
    .from('retos_directos_jugador')
    .select(`
      id, creador_id, estado,
      objetivo:profiles!retos_directos_jugador_jugador_objetivo_id_fkey(full_name, email)
    `)
    .eq('id', retoId)
    .maybeSingle();

  if (!reto?.creador_id) return { ok: true, sent: 0 };

  const objetivo = reto.objetivo as { full_name?: string; email?: string } | null;
  const label = formatProfileLabel(objetivo);
  const estadoLabel =
    estado === 'aceptado' ? 'aceptó' : estado === 'rechazado' ? 'rechazó' : 'actualizó';

  const sent = await sendToUsers(
    supabase,
    [reto.creador_id],
    'Respuesta a tu reto',
    `${label} ${estadoLabel} tu invitación`,
    { type: 'reto_directo_respuesta', reto_id: retoId, estado }
  );
  return { ok: true, sent };
}

async function handleMatchEncontrado(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const partidoId = payload.partido_id;
  const count = Number(payload.matches_count ?? '0');
  if (!partidoId || count <= 0) return { ok: true, sent: 0 };

  const { data: partido } = await supabase
    .from('partidos_abiertos')
    .select('creador_id')
    .eq('id', partidoId)
    .maybeSingle();
  if (!partido?.creador_id) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    [partido.creador_id],
    'Rivales compatibles',
    `Encontramos ${count} rival${count !== 1 ? 'es' : ''} compatible${count !== 1 ? 's' : ''} para tu partido`,
    { type: 'match_encontrado', partido_id: partidoId }
  );
  return { ok: true, sent };
}

async function handleLogroDesbloqueado(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const userId = payload.user_id;
  const logroId = payload.logro_id;
  if (!userId || !logroId) return { ok: false, sent: 0, error: 'user_id y logro_id requeridos' };

  const { data: logro } = await supabase
    .from('logros')
    .select('titulo')
    .eq('id', logroId)
    .maybeSingle();

  const titulo = logro?.titulo ?? 'Logro';
  const sent = await sendToUsers(
    supabase,
    [userId],
    'Logro desbloqueado',
    `¡Desbloqueaste "${titulo}"!`,
    { type: 'logro_desbloqueado', logro_id: logroId }
  );
  return { ok: true, sent };
}

async function handleRecompensaCanjeada(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const userId = payload.user_id;
  const logroTitulo = payload.logro_titulo ?? 'tu recompensa';
  if (!userId) return { ok: false, sent: 0, error: 'user_id requerido' };

  const sent = await sendToUsers(
    supabase,
    [userId],
    'Recompensa canjeada',
    `Canjeaste "${logroTitulo}" en la cancha`,
    { type: 'recompensa_canjeada' }
  );
  return { ok: true, sent };
}

async function handleFacturaRetrasada(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const facturaId = payload.factura_id;
  if (!facturaId) return { ok: false, sent: 0, error: 'factura_id requerido' };

  const { data: factura } = await supabase
    .from('facturas_mensuales')
    .select('admin_id, mes, año')
    .eq('id', facturaId)
    .maybeSingle();
  if (!factura) return { ok: true, sent: 0 };

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const periodo = `${MESES[(factura.mes as number) - 1] ?? factura.mes} ${factura.año}`;

  const sent = await sendToUsers(
    supabase,
    [factura.admin_id as string],
    'Factura retrasada',
    `Tu factura de ${periodo} está retrasada. Revisá Pagos.`,
    { type: 'factura_retrasada', factura_id: facturaId }
  );

  if (sent > 0) {
    await supabase
      .from('facturas_mensuales')
      .update({ notified_retrasado_at: new Date().toISOString() })
      .eq('id', facturaId);
  }

  return { ok: true, sent };
}

async function handleFacturaNueva(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const facturaId = payload.factura_id;
  if (!facturaId) return { ok: false, sent: 0, error: 'factura_id requerido' };

  const { data: factura } = await supabase
    .from('facturas_mensuales')
    .select('admin_id, mes, año')
    .eq('id', facturaId)
    .maybeSingle();
  if (!factura) return { ok: true, sent: 0 };

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const periodo = `${MESES[(factura.mes as number) - 1] ?? factura.mes} ${factura.año}`;

  const sent = await sendToUsers(
    supabase,
    [factura.admin_id as string],
    'Nueva factura disponible',
    `Ya podés pagar tu factura de ${periodo}.`,
    { type: 'factura_nueva', factura_id: facturaId }
  );

  if (sent > 0) {
    await supabase
      .from('facturas_mensuales')
      .update({ notified_nueva_at: new Date().toISOString() })
      .eq('id', facturaId);
  }

  return { ok: true, sent };
}

async function handleFacturaPorVencer(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const facturaId = payload.factura_id;
  if (!facturaId) return { ok: false, sent: 0, error: 'factura_id requerido' };

  const { data: factura } = await supabase
    .from('facturas_mensuales')
    .select('admin_id, mes, año')
    .eq('id', facturaId)
    .maybeSingle();
  if (!factura) return { ok: true, sent: 0 };

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const periodo = `${MESES[(factura.mes as number) - 1] ?? factura.mes} ${factura.año}`;

  const sent = await sendToUsers(
    supabase,
    [factura.admin_id as string],
    'Factura por vencer',
    `Tu factura de ${periodo} vence pronto. Revisá Pagos.`,
    { type: 'factura_por_vencer', factura_id: facturaId }
  );

  if (sent > 0) {
    await supabase
      .from('facturas_mensuales')
      .update({ notified_por_vencer_at: new Date().toISOString() })
      .eq('id', facturaId);
  }

  return { ok: true, sent };
}

async function handleComplejosOcultos(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const adminId = payload.admin_id;
  if (!adminId) return { ok: false, sent: 0, error: 'admin_id requerido' };

  const sent = await sendToUsers(
    supabase,
    [adminId],
    'Complejos ocultos',
    'Tus complejos fueron ocultados por impago. Regularizá tu factura en Pagos.',
    { type: 'complejos_ocultos' }
  );
  return { ok: true, sent };
}

async function handleRecordatorioReserva(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const reservaId = payload.reserva_id;
  const kind = payload.kind ?? 'recordatorio';
  if (!reservaId) return { ok: false, sent: 0, error: 'reserva_id requerido' };

  const ctx = await reservaContext(supabase, reservaId);
  if (!ctx || !ctx.reserva.user_id || !ctx.reserva.made_by_player) return { ok: true, sent: 0 };

  const hoursLabel = kind.includes('24') ? 'mañana' : 'en 2 horas';
  const sent = await sendToUsers(
    supabase,
    [ctx.reserva.user_id],
    'Recordatorio de reserva',
    `Tenés reserva ${hoursLabel} en ${ctx.canchaNombre} · ${formatFechaHoraHN(ctx.reserva.fecha_hora)}`,
    { type: 'recordatorio_reserva', reserva_id: reservaId, kind }
  );
  return { ok: true, sent };
}

async function handleRecordatorioPartido(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<DispatchResult> {
  const reservaId = payload.reserva_id;
  const userId = payload.user_id;
  if (!reservaId || !userId) return { ok: false, sent: 0, error: 'reserva_id y user_id requeridos' };

  const ctx = await reservaContext(supabase, reservaId);
  if (!ctx) return { ok: true, sent: 0 };

  const rival = payload.rival_nombre?.trim() || 'tu rival';
  const sent = await sendToUsers(
    supabase,
    [userId],
    'Partido confirmado pronto',
    `Partido contra ${rival} en 2 h · ${ctx.canchaNombre}`,
    { type: 'recordatorio_partido', reserva_id: reservaId }
  );
  return { ok: true, sent };
}

async function handleRevisionPendienteDigest(
  supabase: SupabaseClient,
  _payload: NotificationPayload
): Promise<DispatchResult> {
  const adminIds = await fetchPlatformAdminIds(supabase);
  if (!adminIds.length) return { ok: true, sent: 0 };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: pagosCount }, { count: reembolsosCount }] = await Promise.all([
    supabase
      .from('transferencias')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente_revision')
      .lt('created_at', cutoff),
    supabase
      .from('solicitudes_reembolso')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .lt('created_at', cutoff),
  ]);

  const total = (pagosCount ?? 0) + (reembolsosCount ?? 0);
  if (total <= 0) return { ok: true, sent: 0 };

  const sent = await sendToUsers(
    supabase,
    adminIds,
    'Revisión pendiente',
    `Tenés ${total} item${total !== 1 ? 's' : ''} en revisión hace más de 24 h`,
    { type: 'revision_pendiente_digest' }
  );
  return { ok: true, sent };
}
