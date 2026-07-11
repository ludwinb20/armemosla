import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { dispatchNotification } from '../_shared/notificationDispatch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** @deprecated Usar dispatch-notification. Wrapper de compatibilidad. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const body = await req.json().catch(() => ({}));
    const transferenciaId = body.transferencia_id as string | undefined;
    const solicitudReembolsoId = body.solicitud_reembolso_id as string | undefined;
    const tipo = body.tipo as string | undefined;

    let result;
    if (tipo === 'solicitud_reembolso' && solicitudReembolsoId) {
      result = await dispatchNotification(supabase, 'solicitud_reembolso_nueva', {
        solicitud_reembolso_id: solicitudReembolsoId,
      });
    } else if (transferenciaId) {
      result = await dispatchNotification(supabase, 'pago_pendiente', {
        transferencia_id: transferenciaId,
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: result.ok, sent: result.sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[notify-admins-pago-pendiente]', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
