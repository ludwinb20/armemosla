-- Evaluación de logros, emisión de recompensas y canje QR
-- Ejecutar después de 30_logros_recompensas.sql y 31_factura_descuentos_canje.sql

CREATE OR REPLACE FUNCTION public._calcular_progreso_logro(
  p_user_id UUID,
  p_logro public.logros
)
RETURNS TABLE (
  valor_actual INTEGER,
  valor_meta INTEGER,
  metadata JSONB,
  cancha_id_dominante UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta INTEGER;
BEGIN
  v_meta := GREATEST(COALESCE((p_logro.criterio_params->>'cantidad')::INTEGER, 1), 1);
  valor_meta := v_meta;
  metadata := '{}'::jsonb;
  cancha_id_dominante := NULL;

  IF p_logro.criterio_tipo = 'reservas_completadas_misma_cancha' THEN
    SELECT r.cancha_id, COUNT(*)::INTEGER
    INTO cancha_id_dominante, valor_actual
    FROM public.reservas r
    WHERE r.user_id = p_user_id
      AND r.made_by_player = true
      AND r.estado = 'completada'
    GROUP BY r.cancha_id
    ORDER BY COUNT(*) DESC, MAX(r.fecha_hora) DESC
    LIMIT 1;

    valor_actual := COALESCE(valor_actual, 0);
    metadata := jsonb_build_object('cancha_id', cancha_id_dominante);
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_logro.criterio_tipo = 'canchas_distintas_jugadas' THEN
    SELECT COUNT(DISTINCT r.cancha_id)::INTEGER
    INTO valor_actual
    FROM public.reservas r
    WHERE r.user_id = p_user_id
      AND r.made_by_player = true
      AND r.estado = 'completada';

    valor_actual := COALESCE(valor_actual, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  valor_actual := 0;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public._emitir_recompensa_logro(
  p_user_id UUID,
  p_logro public.logros,
  p_cancha_id_restriccion UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recompensa_id UUID;
  v_valido_dias INTEGER;
  v_cancha UUID;
  v_restricciones JSONB;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.jugador_recompensas jr
    WHERE jr.user_id = p_user_id
      AND jr.logro_id = p_logro.id
      AND jr.estado IN ('disponible', 'canjeada')
  ) THEN
    RETURN NULL;
  END IF;

  v_restricciones := COALESCE(p_logro.recompensa_restricciones, '{}'::jsonb);
  v_valido_dias := COALESCE((v_restricciones->>'valido_dias')::INTEGER, 90);

  IF COALESCE((v_restricciones->>'misma_cancha_progreso')::BOOLEAN, false) THEN
    v_cancha := p_cancha_id_restriccion;
  ELSE
    v_cancha := NULLIF(v_restricciones->>'cancha_id_fija', '')::UUID;
  END IF;

  INSERT INTO public.jugador_recompensas (
    user_id,
    logro_id,
    estado,
    recompensa_tipo,
    recompensa_valor,
    recompensa_restricciones,
    cancha_id_restriccion,
    expires_at
  )
  VALUES (
    p_user_id,
    p_logro.id,
    'disponible',
    p_logro.recompensa_tipo,
    p_logro.recompensa_valor,
    v_restricciones,
    v_cancha,
    TIMEZONE('utc'::text, NOW()) + (v_valido_dias || ' days')::INTERVAL
  )
  RETURNING id INTO v_recompensa_id;

  RETURN v_recompensa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluar_logro(
  p_user_id UUID,
  p_logro_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logro public.logros;
  v_prog RECORD;
  v_completado BOOLEAN := false;
BEGIN
  SELECT * INTO v_logro FROM public.logros WHERE id = p_logro_id AND activo = true;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_prog FROM public._calcular_progreso_logro(p_user_id, v_logro);

  INSERT INTO public.jugador_logro_progreso (
    user_id, logro_id, valor_actual, valor_meta, metadata, completado_at
  )
  VALUES (
    p_user_id,
    p_logro_id,
    v_prog.valor_actual,
    v_prog.valor_meta,
    v_prog.metadata,
    CASE WHEN v_prog.valor_actual >= v_prog.valor_meta THEN TIMEZONE('utc'::text, NOW()) ELSE NULL END
  )
  ON CONFLICT (user_id, logro_id) DO UPDATE SET
    valor_actual = EXCLUDED.valor_actual,
    valor_meta = EXCLUDED.valor_meta,
    metadata = EXCLUDED.metadata,
    completado_at = COALESCE(
      public.jugador_logro_progreso.completado_at,
      EXCLUDED.completado_at
    ),
    updated_at = TIMEZONE('utc'::text, NOW());

  IF v_prog.valor_actual >= v_prog.valor_meta THEN
    PERFORM public._emitir_recompensa_logro(p_user_id, v_logro, v_prog.cancha_id_dominante);
    v_completado := true;
  END IF;

  RETURN v_completado;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluar_logros_jugador(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logro RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.jugador_recompensas
  SET estado = 'expirada', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE user_id = p_user_id
    AND estado = 'disponible'
    AND expires_at IS NOT NULL
    AND expires_at < TIMEZONE('utc'::text, NOW());

  FOR v_logro IN
    SELECT id FROM public.logros WHERE activo = true ORDER BY orden ASC, created_at ASC
  LOOP
    PERFORM public.evaluar_logro(p_user_id, v_logro.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_evaluar_logros_reserva()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'completada'
     AND (OLD.estado IS DISTINCT FROM NEW.estado)
     AND NEW.made_by_player = true
     AND NEW.user_id IS NOT NULL THEN
    PERFORM public.evaluar_logros_jugador(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluar_logros_reserva ON public.reservas;
CREATE TRIGGER trg_evaluar_logros_reserva
  AFTER UPDATE OF estado ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_evaluar_logros_reserva();

CREATE OR REPLACE FUNCTION public.auto_completar_reservas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN
    WITH updated AS (
      UPDATE public.reservas
      SET estado = 'completada',
          updated_at = TIMEZONE('utc'::text, NOW())
      WHERE estado = 'pendiente'
        AND fecha_hora + INTERVAL '30 minutes' < TIMEZONE('utc'::text, NOW())
      RETURNING user_id, made_by_player
    )
    SELECT DISTINCT u.user_id
    FROM updated u
    WHERE u.user_id IS NOT NULL
      AND u.made_by_player = true
  LOOP
    PERFORM public.evaluar_logros_jugador(v_user_id);
  END LOOP;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.canjear_recompensa_qr(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluar_logros_jugador(UUID) TO authenticated;

COMMENT ON FUNCTION public.evaluar_logros_jugador IS 'Recalcula progreso y emite recompensas para un jugador';
COMMENT ON FUNCTION public.canjear_recompensa_qr IS 'Canjea recompensa escaneada por admin de cancha';
