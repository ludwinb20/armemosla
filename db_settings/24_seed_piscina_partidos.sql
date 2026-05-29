-- Seed de partidos publicados en la piscina (partidos_abiertos + reservas pendientes)
-- Ejecutar después de: 16_partidos_abiertos.sql y 22_seed_jugadores_demo.sql
--
-- Crea reservas FUTURAS en estado 'pendiente' y las publica en la piscina
-- para que otros jugadores las vean en "Pedir reto".
--
-- Requiere usuarios demo en Auth (mismos correos que 22):
--   demo.jugador1@armemosla.test … demo.jugador4@armemosla.test

DO $$
DECLARE
  v_j1 UUID;
  v_j2 UUID;
  v_j3 UUID;
  v_j4 UUID;

  v_eq1 UUID;
  v_eq2 UUID;
  v_eq3 UUID;

  v_cancha_1 UUID;
  v_cancha_2 UUID;
  v_jugadores_1 INTEGER;
  v_jugadores_2 INTEGER;

  v_reserva_id UUID;
  v_fecha TIMESTAMPTZ;
BEGIN
  -- Jugadores demo
  SELECT id INTO v_j1 FROM auth.users WHERE email = 'demo.jugador1@armemosla.test' LIMIT 1;
  SELECT id INTO v_j2 FROM auth.users WHERE email = 'demo.jugador2@armemosla.test' LIMIT 1;
  SELECT id INTO v_j3 FROM auth.users WHERE email = 'demo.jugador3@armemosla.test' LIMIT 1;
  SELECT id INTO v_j4 FROM auth.users WHERE email = 'demo.jugador4@armemosla.test' LIMIT 1;

  IF v_j1 IS NULL OR v_j2 IS NULL OR v_j3 IS NULL OR v_j4 IS NULL THEN
    RAISE EXCEPTION
      'Faltan usuarios demo en Auth. Ejecuta primero 22_seed_jugadores_demo.sql (crear los 4 correos demo).';
  END IF;

  -- Equipos (j2 también recibe equipo para poder publicar en la piscina)
  SELECT id INTO v_eq1 FROM public.equipos
  WHERE creador_id = v_j1 AND nombre = 'Los Catrachos FC'
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_eq3 FROM public.equipos
  WHERE creador_id = v_j3 AND nombre = 'Reto Progreso'
  ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.equipos (nombre, logo_url, creador_id)
  VALUES ('Barrio Unido FC', NULL, v_j2)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_eq2 FROM public.equipos
  WHERE creador_id = v_j2 AND nombre = 'Barrio Unido FC'
  ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.jugador_equipos (jugador_id, equipo_id, es_principal, rol)
  VALUES
    (v_j2, v_eq2, true, 'capitan')
  ON CONFLICT (jugador_id, equipo_id) DO UPDATE
  SET es_principal = EXCLUDED.es_principal, rol = EXCLUDED.rol;

  IF v_eq1 IS NULL OR v_eq2 IS NULL OR v_eq3 IS NULL THEN
    RAISE EXCEPTION 'Faltan equipos demo. Ejecuta 22_seed_jugadores_demo.sql primero.';
  END IF;

  -- Canchas activas
  SELECT c.id, c.jugadores_por_equipo
  INTO v_cancha_1, v_jugadores_1
  FROM public.canchas c
  WHERE c.activo = true
  ORDER BY c.created_at ASC
  LIMIT 1;

  SELECT c.id, c.jugadores_por_equipo
  INTO v_cancha_2, v_jugadores_2
  FROM public.canchas c
  WHERE c.activo = true
    AND c.id <> v_cancha_1
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_cancha_1 IS NULL THEN
    RAISE EXCEPTION 'No hay canchas activas. Crea al menos una cancha activa.';
  END IF;

  IF v_cancha_2 IS NULL THEN
    v_cancha_2 := v_cancha_1;
    v_jugadores_2 := v_jugadores_1;
  END IF;

  -- Helper: reserva pendiente + publicación en piscina (idempotente por jugador + fecha)
  -- 1) Carlos — mañana 18:00
  v_fecha := date_trunc('hour', NOW() + INTERVAL '1 day') + INTERVAL '18 hours';
  IF v_fecha <= NOW() THEN
    v_fecha := v_fecha + INTERVAL '1 day';
  END IF;

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_1, v_fecha, v_j1, true, 'pendiente'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.user_id = v_j1
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
  )
  RETURNING id INTO v_reserva_id;

  IF v_reserva_id IS NULL THEN
    SELECT r.id INTO v_reserva_id
    FROM public.reservas r
    WHERE r.user_id = v_j1
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
    LIMIT 1;
  END IF;

  INSERT INTO public.partidos_abiertos (
    reserva_id, creador_id, equipo_id, jugadores_necesarios, busca_automatico, estado
  )
  SELECT v_reserva_id, v_j1, v_eq1, v_jugadores_1, true, 'abierto'
  WHERE v_reserva_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.partidos_abiertos pa WHERE pa.reserva_id = v_reserva_id);

  -- 2) Marvin — pasado mañana 20:00
  v_fecha := date_trunc('hour', NOW() + INTERVAL '2 days') + INTERVAL '20 hours';
  IF v_fecha <= NOW() THEN
    v_fecha := v_fecha + INTERVAL '1 day';
  END IF;

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_2, v_fecha, v_j2, true, 'pendiente'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.user_id = v_j2
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
  )
  RETURNING id INTO v_reserva_id;

  IF v_reserva_id IS NULL THEN
    SELECT r.id INTO v_reserva_id
    FROM public.reservas r
    WHERE r.user_id = v_j2
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
    LIMIT 1;
  END IF;

  INSERT INTO public.partidos_abiertos (
    reserva_id, creador_id, equipo_id, jugadores_necesarios, busca_automatico, estado
  )
  SELECT v_reserva_id, v_j2, v_eq2, v_jugadores_2, false, 'abierto'
  WHERE v_reserva_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.partidos_abiertos pa WHERE pa.reserva_id = v_reserva_id);

  -- 3) Josue — en 3 días 19:00
  v_fecha := date_trunc('hour', NOW() + INTERVAL '3 days') + INTERVAL '19 hours';
  IF v_fecha <= NOW() THEN
    v_fecha := v_fecha + INTERVAL '1 day';
  END IF;

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_1, v_fecha, v_j3, true, 'pendiente'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.user_id = v_j3
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
  )
  RETURNING id INTO v_reserva_id;

  IF v_reserva_id IS NULL THEN
    SELECT r.id INTO v_reserva_id
    FROM public.reservas r
    WHERE r.user_id = v_j3
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
    LIMIT 1;
  END IF;

  INSERT INTO public.partidos_abiertos (
    reserva_id, creador_id, equipo_id, jugadores_necesarios, busca_automatico, estado
  )
  SELECT v_reserva_id, v_j3, v_eq3, v_jugadores_1, true, 'abierto'
  WHERE v_reserva_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.partidos_abiertos pa WHERE pa.reserva_id = v_reserva_id);

  -- 4) Carlos — en 4 días 10:00 (segunda cancha / horario distinto)
  v_fecha := date_trunc('hour', NOW() + INTERVAL '4 days') + INTERVAL '10 hours';
  IF v_fecha <= NOW() THEN
    v_fecha := v_fecha + INTERVAL '1 day';
  END IF;

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_2, v_fecha, v_j1, true, 'pendiente'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.user_id = v_j1
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
  )
  RETURNING id INTO v_reserva_id;

  IF v_reserva_id IS NULL THEN
    SELECT r.id INTO v_reserva_id
    FROM public.reservas r
    WHERE r.user_id = v_j1
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
    LIMIT 1;
  END IF;

  INSERT INTO public.partidos_abiertos (
    reserva_id, creador_id, equipo_id, jugadores_necesarios, busca_automatico, estado
  )
  SELECT v_reserva_id, v_j1, v_eq1, v_jugadores_2, false, 'abierto'
  WHERE v_reserva_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.partidos_abiertos pa WHERE pa.reserva_id = v_reserva_id);

  -- 5) Josue — en 5 días 21:00
  v_fecha := date_trunc('hour', NOW() + INTERVAL '5 days') + INTERVAL '21 hours';
  IF v_fecha <= NOW() THEN
    v_fecha := v_fecha + INTERVAL '1 day';
  END IF;

  INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
  SELECT v_cancha_2, v_fecha, v_j3, true, 'pendiente'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.user_id = v_j3
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
  )
  RETURNING id INTO v_reserva_id;

  IF v_reserva_id IS NULL THEN
    SELECT r.id INTO v_reserva_id
    FROM public.reservas r
    WHERE r.user_id = v_j3
      AND r.estado = 'pendiente'
      AND r.fecha_hora = v_fecha
    LIMIT 1;
  END IF;

  INSERT INTO public.partidos_abiertos (
    reserva_id, creador_id, equipo_id, jugadores_necesarios, busca_automatico, estado
  )
  SELECT v_reserva_id, v_j3, v_eq3, v_jugadores_2, false, 'abierto'
  WHERE v_reserva_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.partidos_abiertos pa WHERE pa.reserva_id = v_reserva_id);

  RAISE NOTICE 'Seed piscina listo. Partidos abiertos: %',
    (SELECT COUNT(*) FROM public.partidos_abiertos WHERE estado = 'abierto');
END $$;

-- Verificación rápida (opcional)
SELECT
  pa.id AS partido_id,
  pa.estado,
  pa.busca_automatico,
  pa.jugadores_necesarios,
  r.fecha_hora,
  r.estado AS reserva_estado,
  p.full_name AS jugador,
  e.nombre AS equipo,
  c.nombre AS cancha,
  co.nombre AS complejo
FROM public.partidos_abiertos pa
JOIN public.reservas r ON r.id = pa.reserva_id
JOIN public.profiles p ON p.id = pa.creador_id
LEFT JOIN public.equipos e ON e.id = pa.equipo_id
JOIN public.canchas c ON c.id = r.cancha_id
JOIN public.complejos co ON co.id = c.complejo_id
WHERE pa.estado = 'abierto'
ORDER BY r.fecha_hora ASC;
