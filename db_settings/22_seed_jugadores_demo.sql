-- Seed de jugadores/equipos demo para probar "Ofrecer reto"
-- Ejecutar en Supabase SQL Editor después de:
-- 01,02,03,07,11,15,16 y 21
--
-- IMPORTANTE:
-- Este script NO crea usuarios en auth.users (porque en algunos proyectos
-- no existe auth.admin_create_user()).
-- Antes de correrlo, crea estos usuarios desde Supabase Auth > Users:
-- - demo.jugador1@armemosla.test
-- - demo.jugador2@armemosla.test
-- - demo.jugador3@armemosla.test
-- - demo.jugador4@armemosla.test

DO $$
DECLARE
  v_j1 UUID;
  v_j2 UUID;
  v_j3 UUID;
  v_j4 UUID;

  v_eq1 UUID;
  v_eq3 UUID;

  v_cancha_1 UUID;
  v_cancha_2 UUID;
  v_cancha_3 UUID;
BEGIN
  -- 1) Obtener usuarios auth pre-creados
  SELECT id INTO v_j1 FROM auth.users WHERE email = 'demo.jugador1@armemosla.test' LIMIT 1;
  SELECT id INTO v_j2 FROM auth.users WHERE email = 'demo.jugador2@armemosla.test' LIMIT 1;
  SELECT id INTO v_j3 FROM auth.users WHERE email = 'demo.jugador3@armemosla.test' LIMIT 1;
  SELECT id INTO v_j4 FROM auth.users WHERE email = 'demo.jugador4@armemosla.test' LIMIT 1;

  IF v_j1 IS NULL OR v_j2 IS NULL OR v_j3 IS NULL OR v_j4 IS NULL THEN
    RAISE EXCEPTION
      'Faltan usuarios demo en Auth. Crea estos correos y vuelve a correr el script: demo.jugador1@armemosla.test, demo.jugador2@armemosla.test, demo.jugador3@armemosla.test, demo.jugador4@armemosla.test';
  END IF;

  -- 2) Upsert de profiles en modo Jugador
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES
    (v_j1, 'demo.jugador1@armemosla.test', 'Carlos Pineda', 'Jugador'),
    (v_j2, 'demo.jugador2@armemosla.test', 'Marvin Zelaya', 'Jugador'),
    (v_j3, 'demo.jugador3@armemosla.test', 'Josue Figueroa', 'Jugador'),
    (v_j4, 'demo.jugador4@armemosla.test', 'Kevin Ayestas', 'Jugador')
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    user_type = 'Jugador';

  -- 3) Equipos demo (j1 y j3 tienen equipo; j2 y j4 quedan sin equipo)
  INSERT INTO public.equipos (nombre, logo_url, creador_id)
  VALUES ('Los Catrachos FC', NULL, v_j1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_eq1 FROM public.equipos
  WHERE nombre = 'Los Catrachos FC' AND creador_id = v_j1
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.equipos (nombre, logo_url, creador_id)
  VALUES ('Reto Progreso', NULL, v_j3)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_eq3 FROM public.equipos
  WHERE nombre = 'Reto Progreso' AND creador_id = v_j3
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.jugador_equipos (jugador_id, equipo_id, es_principal, rol)
  VALUES
    (v_j1, v_eq1, true, 'capitan'),
    (v_j3, v_eq3, true, 'capitan')
  ON CONFLICT (jugador_id, equipo_id) DO UPDATE
  SET
    es_principal = EXCLUDED.es_principal,
    rol = EXCLUDED.rol;

  -- 4) Obtener 3 canchas activas para generar historial de complejos en común
  SELECT c.id INTO v_cancha_1
  FROM public.canchas c
  WHERE c.activo = true
  ORDER BY c.created_at ASC
  LIMIT 1;

  SELECT c.id INTO v_cancha_2
  FROM public.canchas c
  WHERE c.activo = true
    AND c.id <> v_cancha_1
  ORDER BY c.created_at ASC
  LIMIT 1;

  SELECT c.id INTO v_cancha_3
  FROM public.canchas c
  WHERE c.activo = true
    AND c.id <> v_cancha_1
    AND c.id <> v_cancha_2
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_cancha_1 IS NULL THEN
    RAISE EXCEPTION 'No hay canchas activas para generar datos demo. Crea al menos 1 cancha activa.';
  END IF;

  -- 5) Reservas demo para "cercanía"
  -- j1 comparte complejo principal con j2 y j3; j4 comparte menos.
  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_1, date_trunc('minute', NOW() - INTERVAL '12 days'), v_j1, true, 'completada'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas
    WHERE cancha_id = v_cancha_1
      AND user_id = v_j1
      AND fecha_hora = date_trunc('minute', NOW() - INTERVAL '12 days')
  );

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_1, date_trunc('minute', NOW() - INTERVAL '10 days'), v_j2, true, 'completada'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas
    WHERE cancha_id = v_cancha_1
      AND user_id = v_j2
      AND fecha_hora = date_trunc('minute', NOW() - INTERVAL '10 days')
  );

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_1, date_trunc('minute', NOW() - INTERVAL '8 days'), v_j3, true, 'completada'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas
    WHERE cancha_id = v_cancha_1
      AND user_id = v_j3
      AND fecha_hora = date_trunc('minute', NOW() - INTERVAL '8 days')
  );

  IF v_cancha_2 IS NOT NULL THEN
    INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
    SELECT v_cancha_2, date_trunc('minute', NOW() - INTERVAL '7 days'), v_j1, true, 'completada'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reservas
      WHERE cancha_id = v_cancha_2
        AND user_id = v_j1
        AND fecha_hora = date_trunc('minute', NOW() - INTERVAL '7 days')
    );

    INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
    SELECT v_cancha_2, date_trunc('minute', NOW() - INTERVAL '5 days'), v_j3, true, 'completada'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reservas
      WHERE cancha_id = v_cancha_2
        AND user_id = v_j3
        AND fecha_hora = date_trunc('minute', NOW() - INTERVAL '5 days')
    );
  END IF;

  IF v_cancha_3 IS NOT NULL THEN
    INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
    SELECT v_cancha_3, date_trunc('minute', NOW() - INTERVAL '3 days'), v_j4, true, 'completada'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reservas
      WHERE cancha_id = v_cancha_3
        AND user_id = v_j4
        AND fecha_hora = date_trunc('minute', NOW() - INTERVAL '3 days')
    );
  END IF;
END $$;
