-- Push notifications: outbox, reminders, flags y triggers
-- Ejecutar después de 53_seed_revision_pagos_demo.sql

-- ---------------------------------------------------------------------------
-- Flags de notificación en facturas
-- ---------------------------------------------------------------------------
ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS notified_retrasado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_nueva_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_por_vencer_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Cola de notificaciones (eventos originados en SQL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_notification_outbox (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_ids UUID[] NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_outbox_pending
  ON public.push_notification_outbox(status, created_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Dedup de recordatorios cron
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_reminders_log (
  kind TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (kind, reference_id)
);

-- ---------------------------------------------------------------------------
-- Helper: encolar notificación
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_push_notification(
  p_user_ids UUID[],
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.push_notification_outbox (user_ids, title, body, data)
  VALUES (p_user_ids, TRIM(p_title), TRIM(p_body), COALESCE(p_data, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: logro desbloqueado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_push_logro_desbloqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completado_at IS NOT NULL AND (OLD.completado_at IS NULL OR OLD.completado_at IS DISTINCT FROM NEW.completado_at) THEN
    PERFORM public.enqueue_push_notification(
      ARRAY[NEW.user_id],
      'Logro desbloqueado',
      '¡Desbloqueaste un nuevo logro!',
      jsonb_build_object('type', 'logro_desbloqueado', 'logro_id', NEW.logro_id::text, 'user_id', NEW.user_id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_logro_desbloqueado ON public.jugador_logro_progreso;
CREATE TRIGGER push_logro_desbloqueado
  AFTER INSERT OR UPDATE OF completado_at ON public.jugador_logro_progreso
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_push_logro_desbloqueado();

-- ---------------------------------------------------------------------------
-- Trigger: respuesta reto directo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_push_reto_directo_respuesta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado
     AND NEW.estado IN ('aceptado', 'rechazado', 'cancelado') THEN
    PERFORM public.enqueue_push_notification(
      ARRAY[NEW.creador_id],
      'Respuesta a tu reto',
      'Un jugador respondió tu invitación de reto',
      jsonb_build_object(
        'type', 'reto_directo_respuesta',
        'reto_id', NEW.id::text,
        'estado', NEW.estado
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_reto_directo_respuesta ON public.retos_directos_jugador;
CREATE TRIGGER push_reto_directo_respuesta
  AFTER UPDATE OF estado ON public.retos_directos_jugador
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_push_reto_directo_respuesta();

-- ---------------------------------------------------------------------------
-- canjear_recompensa_qr: encolar notificación al jugador
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canjear_recompensa_qr(
  p_token UUID,
  p_cancha_id UUID,
  p_reserva_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_recompensa public.jugador_recompensas;
  v_logro public.logros;
  v_reserva public.reservas;
  v_precio DECIMAL(10, 2);
  v_monto DECIMAL(10, 2);
  v_canje_id UUID;
  v_jugador_nombre TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_admin_id AND p.user_type = 'Administrador de Cancha'
  ) THEN
    RAISE EXCEPTION 'Solo administradores de cancha pueden escanear recompensas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canchas c
    INNER JOIN public.complejos co ON co.id = c.complejo_id
    WHERE c.id = p_cancha_id AND co.admin_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'No administrás esta cancha';
  END IF;

  SELECT * INTO v_recompensa
  FROM public.jugador_recompensas
  WHERE canje_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código QR inválido';
  END IF;

  IF v_recompensa.estado <> 'disponible' THEN
    RAISE EXCEPTION 'Esta recompensa ya fue canjeada o expiró';
  END IF;

  IF v_recompensa.expires_at IS NOT NULL
     AND v_recompensa.expires_at < TIMEZONE('utc'::text, NOW()) THEN
    UPDATE public.jugador_recompensas
    SET estado = 'expirada', updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_recompensa.id;
    RAISE EXCEPTION 'Esta recompensa expiró';
  END IF;

  IF v_recompensa.cancha_id_restriccion IS NOT NULL
     AND v_recompensa.cancha_id_restriccion <> p_cancha_id THEN
    RAISE EXCEPTION 'Esta recompensa solo aplica en la cancha donde ganaste el logro';
  END IF;

  SELECT * INTO v_reserva
  FROM public.reservas
  WHERE id = p_reserva_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  IF v_reserva.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La reserva debe estar pendiente';
  END IF;

  IF v_reserva.cancha_id <> p_cancha_id THEN
    RAISE EXCEPTION 'La reserva no corresponde a esta cancha';
  END IF;

  IF v_reserva.user_id <> v_recompensa.user_id THEN
    RAISE EXCEPTION 'La reserva no pertenece al jugador de la recompensa';
  END IF;

  IF v_reserva.made_by_player IS NOT TRUE THEN
    RAISE EXCEPTION 'Solo aplica a reservas de jugadores';
  END IF;

  IF v_reserva.canje_recompensa_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta reserva ya tiene un canje aplicado';
  END IF;

  SELECT precio_por_hora INTO v_precio
  FROM public.canchas WHERE id = p_cancha_id;

  IF v_precio IS NULL THEN
    RAISE EXCEPTION 'Cancha no encontrada';
  END IF;

  IF v_recompensa.recompensa_tipo = 'reserva_gratis' THEN
    v_monto := v_precio;
  ELSIF v_recompensa.recompensa_tipo = 'porcentaje' THEN
    v_monto := ROUND(v_precio * v_recompensa.recompensa_valor / 100.0, 2);
  ELSIF v_recompensa.recompensa_tipo = 'monto_fijo' THEN
    v_monto := LEAST(v_recompensa.recompensa_valor, v_precio);
  ELSE
    RAISE EXCEPTION 'Tipo de recompensa no soportado';
  END IF;

  SELECT * INTO v_logro FROM public.logros WHERE id = v_recompensa.logro_id;
  SELECT COALESCE(full_name, email, 'Jugador') INTO v_jugador_nombre
  FROM public.profiles WHERE id = v_recompensa.user_id;

  INSERT INTO public.canjes_recompensa (
    recompensa_id, logro_id, reserva_id, cancha_id,
    admin_id, jugador_id, monto_descontado, logro_titulo
  )
  VALUES (
    v_recompensa.id, v_recompensa.logro_id, p_reserva_id, p_cancha_id,
    v_admin_id, v_recompensa.user_id, v_monto, v_logro.titulo
  )
  RETURNING id INTO v_canje_id;

  UPDATE public.jugador_recompensas
  SET estado = 'canjeada', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = v_recompensa.id;

  UPDATE public.reservas
  SET canje_recompensa_id = v_recompensa.id,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_reserva_id;

  PERFORM public.enqueue_push_notification(
    ARRAY[v_recompensa.user_id],
    'Recompensa canjeada',
    'Canjeaste "' || COALESCE(v_logro.titulo, 'tu recompensa') || '" en la cancha',
    jsonb_build_object(
      'type', 'recompensa_canjeada',
      'user_id', v_recompensa.user_id::text,
      'logro_titulo', COALESCE(v_logro.titulo, '')
    )
  );

  RETURN jsonb_build_object(
    'canje_id', v_canje_id,
    'jugador_nombre', v_jugador_nombre,
    'logro_titulo', v_logro.titulo,
    'monto_descontado', v_monto,
    'reserva_id', p_reserva_id,
    'cancha_id', p_cancha_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_push_notification(UUID[], TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_push_notification(UUID[], TEXT, TEXT, JSONB) TO service_role;

COMMENT ON TABLE public.push_notification_outbox IS 'Cola de push notifications procesada por cron-push-notifications';
COMMENT ON TABLE public.push_reminders_log IS 'Dedup de recordatorios push enviados por cron';
