import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { dispatchNotification } from '../_shared/notificationDispatch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const HN_TZ = 'America/Tegucigalpa';

function nowInHonduras(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: HN_TZ }));
}

async function reminderAlreadySent(
  supabase: ReturnType<typeof createClient>,
  kind: string,
  referenceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('push_reminders_log')
    .select('kind')
    .eq('kind', kind)
    .eq('reference_id', referenceId)
    .maybeSingle();
  return Boolean(data);
}

async function markReminderSent(
  supabase: ReturnType<typeof createClient>,
  kind: string,
  referenceId: string
): Promise<void> {
  await supabase.from('push_reminders_log').upsert(
    { kind, reference_id: referenceId, sent_at: new Date().toISOString() },
    { onConflict: 'kind,reference_id' }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'CRON_SECRET no configurado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const headerSecret = req.headers.get('x-cron-secret');
  if ((bearer ?? headerSecret) !== cronSecret) {
    return unauthorized('No autorizado');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Config faltante' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: Record<string, number> = { sent: 0 };

  await supabase.rpc('procesar_politicas_pago_facturas');

  const { data: facturasRetrasadas } = await supabase
    .from('facturas_mensuales')
    .select('id')
    .eq('estado_pago', 'retrasado')
    .is('notified_retrasado_at', null);

  for (const f of facturasRetrasadas ?? []) {
    const r = await dispatchNotification(supabase, 'factura_retrasada', { factura_id: f.id });
    summary.sent += r.sent;
  }

  const hnNow = nowInHonduras();
  if (hnNow.getDate() === 1) {
    const prevMonth = hnNow.getMonth() === 0 ? 12 : hnNow.getMonth();
    const prevYear = hnNow.getMonth() === 0 ? hnNow.getFullYear() - 1 : hnNow.getFullYear();

    const { data: facturasNuevas } = await supabase
      .from('facturas_mensuales')
      .select('id')
      .eq('mes', prevMonth)
      .eq('año', prevYear)
      .is('notified_nueva_at', null);

    for (const f of facturasNuevas ?? []) {
      const r = await dispatchNotification(supabase, 'factura_nueva', { factura_id: f.id });
      summary.sent += r.sent;
    }
  }

  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const vencimientoLimite = new Date(Date.now() + threeDaysMs).toISOString();

  const { data: facturasPorVencer } = await supabase
    .from('facturas_mensuales')
    .select('id, fecha_limite_pago')
    .in('estado_pago', ['pendiente', 'en_revision', 'retrasado'])
    .is('notified_por_vencer_at', null)
    .not('fecha_limite_pago', 'is', null)
    .lte('fecha_limite_pago', vencimientoLimite);

  for (const f of facturasPorVencer ?? []) {
    const r = await dispatchNotification(supabase, 'factura_por_vencer', { factura_id: f.id });
    summary.sent += r.sent;
  }

  const { data: adminsOcultos } = await supabase
    .from('complejos')
    .select('admin_id')
    .eq('oculto', true);

  const adminIdsOcultos = [...new Set((adminsOcultos ?? []).map((c) => c.admin_id as string))];
  for (const adminId of adminIdsOcultos) {
    const kind = 'complejos_ocultos';
    if (await reminderAlreadySent(supabase, kind, adminId)) continue;
    const r = await dispatchNotification(supabase, 'complejos_ocultos', { admin_id: adminId });
    if (r.sent > 0) {
      await markReminderSent(supabase, kind, adminId);
      summary.sent += r.sent;
    }
  }

  const { data: outboxRows } = await supabase
    .from('push_notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  for (const row of outboxRows ?? []) {
    const data = (row.data as Record<string, string>) ?? {};
    const eventType = data.type;

    let r;
    if (eventType && eventType !== 'direct') {
      r = await dispatchNotification(supabase, eventType, data);
    } else {
      const userIds = (row.user_ids as string[]) ?? [];
      r = await dispatchNotification(supabase, 'send_direct', {
        user_ids: userIds.join(','),
        title: row.title as string,
        body: row.body as string,
        event_type: eventType ?? 'outbox',
        data_json: JSON.stringify(data),
      });
    }

    if (r.ok) {
      await supabase
        .from('push_notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);
      summary.sent += r.sent;
    }
  }

  const nowMs = Date.now();
  const window24hMin = nowMs + 23 * 60 * 60 * 1000;
  const window24hMax = nowMs + 25 * 60 * 60 * 1000;
  const window2hMin = nowMs + 1.5 * 60 * 60 * 1000;
  const window2hMax = nowMs + 2.5 * 60 * 60 * 1000;

  const { data: reservasPendientes } = await supabase
    .from('reservas')
    .select('id, fecha_hora, user_id')
    .eq('estado', 'pendiente')
    .eq('made_by_player', true)
    .gte('fecha_hora', new Date(nowMs).toISOString());

  for (const reserva of reservasPendientes ?? []) {
    const fhMs = new Date(reserva.fecha_hora as string).getTime();

    if (fhMs >= window24hMin && fhMs <= window24hMax) {
      const kind = 'reserva_24h';
      if (!(await reminderAlreadySent(supabase, kind, reserva.id as string))) {
        const r = await dispatchNotification(supabase, 'recordatorio_reserva', {
          reserva_id: reserva.id as string,
          kind,
        });
        if (r.sent > 0) {
          await markReminderSent(supabase, kind, reserva.id as string);
          summary.sent += r.sent;
        }
      }
    }

    if (fhMs >= window2hMin && fhMs <= window2hMax) {
      const kind = 'reserva_2h';
      if (!(await reminderAlreadySent(supabase, kind, reserva.id as string))) {
        const r = await dispatchNotification(supabase, 'recordatorio_reserva', {
          reserva_id: reserva.id as string,
          kind,
        });
        if (r.sent > 0) {
          await markReminderSent(supabase, kind, reserva.id as string);
          summary.sent += r.sent;
        }
      }
    }
  }

  const digestHour = hnNow.getHours();
  if (digestHour === 9 && hnNow.getMinutes() < 15) {
    const digestKind = `revision_digest_${hnNow.toISOString().slice(0, 10)}`;
    if (!(await reminderAlreadySent(supabase, digestKind, 'platform'))) {
      const r = await dispatchNotification(supabase, 'revision_pendiente_digest', {});
      if (r.sent > 0) {
        await markReminderSent(supabase, digestKind, 'platform');
        summary.sent += r.sent;
      }
    }
  }

  const { data: partidosConfirmados } = await supabase
    .from('partidos_abiertos')
    .select(`
      id, creador_id,
      reserva:reservas(id, fecha_hora, user_id),
      equipo:equipos(nombre),
      solicitudes:solicitudes_partidos(id, estado, equipo_solicitante_id)
    `)
    .eq('estado', 'confirmado');

  for (const partido of partidosConfirmados ?? []) {
    const reserva = partido.reserva as { id?: string; fecha_hora?: string; user_id?: string } | null;
    if (!reserva?.id || !reserva.fecha_hora) continue;
    const fhMs = new Date(reserva.fecha_hora).getTime();
    if (fhMs < window2hMin || fhMs > window2hMax) continue;

    const solicitudes = (partido as { solicitudes?: { id: string; estado: string; equipo_solicitante_id: string }[] }).solicitudes ?? [];
    const aceptada = solicitudes.find((s) => s.estado === 'aceptada');
    const rivalNombre = (partido as { equipo?: { nombre?: string } }).equipo?.nombre ?? 'tu rival';
    const kind = `partido_2h_${reserva.id}`;

    if (await reminderAlreadySent(supabase, kind, reserva.id)) continue;

    let sentPartido = 0;
    if (partido.creador_id) {
      const r = await dispatchNotification(supabase, 'recordatorio_partido', {
        reserva_id: reserva.id,
        user_id: partido.creador_id as string,
        rival_nombre: rivalNombre,
      });
      sentPartido += r.sent;
    }
    if (aceptada?.equipo_solicitante_id) {
      const { data: members } = await supabase
        .from('jugador_equipos')
        .select('jugador_id')
        .eq('equipo_id', aceptada.equipo_solicitante_id);
      for (const m of members ?? []) {
        const r = await dispatchNotification(supabase, 'recordatorio_partido', {
          reserva_id: reserva.id,
          user_id: m.jugador_id as string,
          rival_nombre: rivalNombre,
        });
        sentPartido += r.sent;
      }
    }

    if (sentPartido > 0) {
      await markReminderSent(supabase, kind, reserva.id);
      summary.sent += sentPartido;
    }
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
