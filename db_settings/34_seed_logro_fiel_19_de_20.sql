-- Progreso 19/20 para "Fiel a la cancha" (falta 1 reserva completada)
-- Ejecutar después de: 30_logros_recompensas.sql y 33_seed_logros_iniciales.sql
-- (32_logros_evaluacion.sql es opcional para este seed; recomendado para producción)
--
-- 1) Poné tu correo en v_jugador_email, O dejá NULL para usar el jugador con más reservas.
-- 2) Opcional: fijá v_cancha_nombre si querés una cancha concreta (NULL = la que ya más uses, o la primera activa).
-- 3) Ejecutá en Supabase SQL Editor.

DO $$
DECLARE
  v_jugador_email TEXT := 'lblancoorellana@gmail.com';
  v_cancha_nombre TEXT := 'Cancha 1';

  v_user_id UUID;
  v_logro_id UUID;
  v_cancha_id UUID;
  v_meta INTEGER := 20;
  v_objetivo INTEGER := 19;
  v_existentes INTEGER;
  v_total_cancha INTEGER;
  -- Fechas en el pasado (no aparecen como reservas futuras en la app)
  v_seed_hasta TIMESTAMPTZ;
  v_seed_desde TIMESTAMPTZ;
  i INTEGER;
  v_email_placeholder BOOLEAN;
BEGIN
  v_email_placeholder := (
    v_jugador_email IS NULL
    OR trim(v_jugador_email) = ''
    OR v_jugador_email LIKE 'TU_CORREO%'
  );

  IF v_email_placeholder THEN
    SELECT p.id, p.email
    INTO v_user_id, v_jugador_email
    FROM public.profiles p
    WHERE p.user_type = 'Jugador'
    ORDER BY (
      SELECT COUNT(*)
      FROM public.reservas r
      WHERE r.user_id = p.id AND r.made_by_player = true
    ) DESC,
    p.created_at DESC
    LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION
        'No hay jugadores en profiles. Definí v_jugador_email := ''tu@correo.com'';';
    END IF;

    RAISE NOTICE 'Jugador auto-seleccionado: %', v_jugador_email;
  ELSE
    SELECT p.id INTO v_user_id
    FROM public.profiles p
    WHERE lower(trim(p.email)) = lower(trim(v_jugador_email))
    LIMIT 1;

    IF v_user_id IS NULL THEN
      SELECT u.id INTO v_user_id
      FROM auth.users u
      WHERE lower(trim(u.email)) = lower(trim(v_jugador_email))
      LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró usuario con email %', v_jugador_email;
    END IF;
  END IF;

  SELECT id INTO v_logro_id
  FROM public.logros
  WHERE codigo = 'fiel_a_la_cancha' AND activo = true
  LIMIT 1;

  IF v_logro_id IS NULL THEN
    RAISE EXCEPTION 'Corré primero 33_seed_logros_iniciales.sql';
  END IF;

  -- Cancha objetivo
  IF v_cancha_nombre IS NOT NULL AND trim(v_cancha_nombre) <> '' THEN
    SELECT c.id INTO v_cancha_id
    FROM public.canchas c
    WHERE lower(trim(c.nombre)) = lower(trim(v_cancha_nombre))
      AND c.activo = true
    LIMIT 1;

    IF v_cancha_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró cancha activa con nombre %', v_cancha_nombre;
    END IF;
  ELSE
    SELECT r.cancha_id INTO v_cancha_id
    FROM public.reservas r
    WHERE r.user_id = v_user_id
      AND r.made_by_player = true
      AND r.estado = 'completada'
    GROUP BY r.cancha_id
    ORDER BY COUNT(*) DESC, MAX(r.fecha_hora) DESC
    LIMIT 1;

    IF v_cancha_id IS NULL THEN
      SELECT c.id INTO v_cancha_id
      FROM public.canchas c
      WHERE c.activo = true
      ORDER BY c.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_cancha_id IS NULL THEN
    RAISE EXCEPTION 'No hay canchas activas en el sistema.';
  END IF;

  v_seed_hasta := date_trunc('day', TIMEZONE('utc'::text, NOW())) - INTERVAL '2 days' + INTERVAL '18 hours';
  v_seed_desde := v_seed_hasta - INTERVAL '19 days';

  -- Quitar recompensa previa de prueba (si existía)
  DELETE FROM public.jugador_recompensas
  WHERE user_id = v_user_id AND logro_id = v_logro_id;

  -- Reservas de seed anteriores (2099 obsoleto + rango actual de prueba)
  DELETE FROM public.reservas
  WHERE user_id = v_user_id
    AND cancha_id = v_cancha_id
    AND estado = 'completada'
    AND made_by_player = true
    AND (
      (fecha_hora >= TIMESTAMPTZ '2099-01-01' AND fecha_hora < TIMESTAMPTZ '2100-01-01')
      OR (fecha_hora >= v_seed_desde AND fecha_hora <= v_seed_hasta)
    );

  SELECT COUNT(*)::INTEGER INTO v_existentes
  FROM public.reservas r
  WHERE r.user_id = v_user_id
    AND r.cancha_id = v_cancha_id
    AND r.made_by_player = true
    AND r.estado = 'completada'
    AND NOT (
      (r.fecha_hora >= TIMESTAMPTZ '2099-01-01' AND r.fecha_hora < TIMESTAMPTZ '2100-01-01')
      OR (r.fecha_hora >= v_seed_desde AND r.fecha_hora <= v_seed_hasta)
    );

  IF v_existentes >= v_meta THEN
    RAISE NOTICE
      'Ya tenés % reservas completadas en esa cancha (meta %). No se insertó nada.',
      v_existentes, v_meta;
  ELSE
    FOR i IN 1..(v_objetivo - v_existentes) LOOP
      INSERT INTO public.reservas (
        cancha_id,
        fecha_hora,
        user_id,
        made_by_player,
        estado
      )
      VALUES (
        v_cancha_id,
        v_seed_desde + ((i - 1) || ' days')::INTERVAL + ((i % 12) || ' hours')::INTERVAL,
        v_user_id,
        true,
        'completada'
      );
    END LOOP;
  END IF;

  -- Sincronizar progreso (no requiere 32_logros_evaluacion.sql)
  SELECT COUNT(*)::INTEGER INTO v_total_cancha
  FROM public.reservas r
  WHERE r.user_id = v_user_id
    AND r.cancha_id = v_cancha_id
    AND r.made_by_player = true
    AND r.estado = 'completada';

  INSERT INTO public.jugador_logro_progreso (
    user_id, logro_id, valor_actual, valor_meta, metadata, completado_at
  )
  VALUES (
    v_user_id,
    v_logro_id,
    v_total_cancha,
    v_meta,
    jsonb_build_object('cancha_id', v_cancha_id),
    CASE WHEN v_total_cancha >= v_meta THEN TIMEZONE('utc'::text, NOW()) ELSE NULL END
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

  RAISE NOTICE '--- Logro Fiel a la cancha (usuario: %) ---', v_jugador_email;
  RAISE NOTICE 'Progreso: % / % en %', v_total_cancha, v_meta, (SELECT nombre FROM public.canchas WHERE id = v_cancha_id);
  RAISE NOTICE 'Cancha: %', (SELECT nombre FROM public.canchas WHERE id = v_cancha_id);
  RAISE NOTICE 'Completá 1 reserva más en ESA cancha para desbloquear la recompensa.';
END $$;

SELECT
  p.email,
  l.titulo,
  jlp.valor_actual,
  jlp.valor_meta,
  jlp.metadata,
  c.nombre AS cancha_progreso,
  CASE
    WHEN jlp.valor_actual >= jlp.valor_meta THEN 'Logro completado'
    ELSE (jlp.valor_meta - jlp.valor_actual)::TEXT || ' reserva(s) restante(s)'
  END AS estado
FROM public.jugador_logro_progreso jlp
JOIN public.profiles p ON p.id = jlp.user_id
JOIN public.logros l ON l.id = jlp.logro_id
LEFT JOIN public.canchas c ON c.id = (jlp.metadata->>'cancha_id')::UUID
WHERE l.codigo = 'fiel_a_la_cancha'
  AND lower(trim(p.email)) = lower(trim('lblancoorellana@gmail.com'));
