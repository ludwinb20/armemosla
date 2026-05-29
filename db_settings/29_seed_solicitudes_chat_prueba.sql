-- Solicitudes + mensajes de chat hacia TU partido en la piscina (prueba badges / conversación)
-- Ejecutar después de: 22, 24, 26_mensajes_solicitud.sql
--
-- 1) Publicá un partido en la app con tu usuario (Armemosla → Apartar y buscar rival).
-- 2) Pon tu correo abajo (el mismo con el que iniciás sesión).
-- 3) Ejecutá este script en Supabase SQL Editor.
--
-- Crea hasta 2 solicitudes pendientes de jugadores demo (Marvin y Josue) con hilo de mensajes.

DO $$
DECLARE
  -- ⚠️ CAMBIAR: correo de tu cuenta (anfitrión del partido en la pool)
  v_anfitrion_email TEXT := 'TU_CORREO@ejemplo.com';

  v_partido_id UUID;
  v_creador_id UUID;
  v_equipo_anfitrion_id UUID;

  v_j2 UUID; -- Marvin Zelaya
  v_j3 UUID; -- Josue Figueroa
  v_eq2 UUID; -- Barrio Unido FC
  v_eq3 UUID; -- Reto Progreso

  v_solicitud_id UUID;
  v_base TIMESTAMPTZ;
  v_insertadas INTEGER := 0;
  v_mensajes INTEGER := 0;
BEGIN
  IF v_anfitrion_email IS NULL OR trim(v_anfitrion_email) = '' OR v_anfitrion_email LIKE 'TU_CORREO%' THEN
    RAISE EXCEPTION
      'Edita v_anfitrion_email al inicio del script con el correo de tu usuario en la app.';
  END IF;

  SELECT pa.id, pa.creador_id, pa.equipo_id
  INTO v_partido_id, v_creador_id, v_equipo_anfitrion_id
  FROM public.partidos_abiertos pa
  JOIN public.profiles p ON p.id = pa.creador_id
  WHERE pa.estado = 'abierto'
    AND lower(trim(p.email)) = lower(trim(v_anfitrion_email))
  ORDER BY pa.created_at DESC
  LIMIT 1;

  IF v_partido_id IS NULL THEN
    RAISE EXCEPTION
      'No hay partido abierto en la pool para %. Publicá uno desde la app primero.',
      v_anfitrion_email;
  END IF;

  SELECT id INTO v_j2 FROM auth.users WHERE email = 'demo.jugador2@armemosla.test' LIMIT 1;
  SELECT id INTO v_j3 FROM auth.users WHERE email = 'demo.jugador3@armemosla.test' LIMIT 1;

  IF v_j2 IS NULL OR v_j3 IS NULL THEN
    RAISE EXCEPTION 'Faltan demo.jugador2 o demo.jugador3. Ejecuta 22_seed_jugadores_demo.sql.';
  END IF;

  SELECT id INTO v_eq2 FROM public.equipos
  WHERE creador_id = v_j2 AND nombre = 'Barrio Unido FC'
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_eq3 FROM public.equipos
  WHERE creador_id = v_j3 AND nombre = 'Reto Progreso'
  ORDER BY created_at ASC LIMIT 1;

  IF v_eq2 IS NULL THEN
    INSERT INTO public.equipos (nombre, creador_id) VALUES ('Barrio Unido FC', v_j2);
    SELECT id INTO v_eq2 FROM public.equipos WHERE creador_id = v_j2 AND nombre = 'Barrio Unido FC' LIMIT 1;
    INSERT INTO public.jugador_equipos (jugador_id, equipo_id, es_principal, rol)
    VALUES (v_j2, v_eq2, true, 'capitan')
    ON CONFLICT (jugador_id, equipo_id) DO NOTHING;
  END IF;

  IF v_eq3 IS NULL THEN
    RAISE EXCEPTION 'Falta equipo Reto Progreso (j3). Ejecuta 22_seed_jugadores_demo.sql.';
  END IF;

  -- ── Solicitud 1: Marvin / Barrio Unido FC ─────────────────────────────
  IF v_eq2 IS DISTINCT FROM v_equipo_anfitrion_id THEN
    SELECT sp.id INTO v_solicitud_id
    FROM public.solicitudes_partidos sp
    WHERE sp.partido_id = v_partido_id
      AND sp.equipo_solicitante_id = v_eq2
    LIMIT 1;

    IF v_solicitud_id IS NULL THEN
      v_base := NOW() - INTERVAL '2 hours';

      INSERT INTO public.solicitudes_partidos (
        partido_id, equipo_solicitante_id, mensaje, estado, created_at
      )
      VALUES (
        v_partido_id,
        v_eq2,
        '¡Hola! Somos Barrio Unido FC. ¿Les parece el reto para ese horario?',
        'pendiente',
        v_base
      )
      RETURNING id INTO v_solicitud_id;

      v_insertadas := v_insertadas + 1;
    END IF;

    IF v_solicitud_id IS NOT NULL THEN
      DELETE FROM public.mensajes_solicitud WHERE solicitud_id = v_solicitud_id;

      v_base := COALESCE(
        (SELECT created_at FROM public.solicitudes_partidos WHERE id = v_solicitud_id),
        NOW() - INTERVAL '2 hours'
      );

      INSERT INTO public.mensajes_solicitud (solicitud_id, sender_id, body, created_at)
      VALUES
        (
          v_solicitud_id,
          v_j2,
          '¡Hola! Somos Barrio Unido FC. ¿Les parece el reto para ese horario?',
          v_base
        ),
        (
          v_solicitud_id,
          v_j2,
          'Vamos completos y con buena actitud. ¿Confirmamos cancha y hora?',
          v_base + INTERVAL '8 minutes'
        ),
        (
          v_solicitud_id,
          v_j2,
          'Si les cuadra, avisen y armamos los detalles del partido.',
          v_base + INTERVAL '25 minutes'
        );

      v_mensajes := v_mensajes + 3;

      DELETE FROM public.solicitud_lecturas
      WHERE solicitud_id = v_solicitud_id AND user_id = v_creador_id;
    END IF;
  END IF;

  v_solicitud_id := NULL;

  -- ── Solicitud 2: Josue / Reto Progreso ────────────────────────────────
  IF v_eq3 IS DISTINCT FROM v_equipo_anfitrion_id
     AND NOT EXISTS (
       SELECT 1 FROM public.jugador_equipos je
       WHERE je.equipo_id = v_eq3 AND je.jugador_id = v_creador_id
     ) THEN
    SELECT sp.id INTO v_solicitud_id
    FROM public.solicitudes_partidos sp
    WHERE sp.partido_id = v_partido_id
      AND sp.equipo_solicitante_id = v_eq3
    LIMIT 1;

    IF v_solicitud_id IS NULL THEN
      v_base := NOW() - INTERVAL '45 minutes';

      INSERT INTO public.solicitudes_partidos (
        partido_id, equipo_solicitante_id, mensaje, estado, created_at
      )
      VALUES (
        v_partido_id,
        v_eq3,
        'Reto Progreso acá. Tenemos ganas de jugar ese día.',
        'pendiente',
        v_base
      )
      RETURNING id INTO v_solicitud_id;

      v_insertadas := v_insertadas + 1;
    END IF;

    IF v_solicitud_id IS NOT NULL THEN
      DELETE FROM public.mensajes_solicitud WHERE solicitud_id = v_solicitud_id;

      v_base := COALESCE(
        (SELECT created_at FROM public.solicitudes_partidos WHERE id = v_solicitud_id),
        NOW() - INTERVAL '45 minutes'
      );

      INSERT INTO public.mensajes_solicitud (solicitud_id, sender_id, body, created_at)
      VALUES
        (
          v_solicitud_id,
          v_j3,
          'Reto Progreso acá. Tenemos ganas de jugar ese día.',
          v_base
        ),
        (
          v_solicitud_id,
          v_j3,
          '¿Cuántos van por lado? Nosotros podemos traer 7.',
          v_base + INTERVAL '12 minutes'
        );

      v_mensajes := v_mensajes + 2;

      DELETE FROM public.solicitud_lecturas
      WHERE solicitud_id = v_solicitud_id AND user_id = v_creador_id;
    END IF;
  END IF;

  RAISE NOTICE
    'Listo para %. Partido: %. Solicitudes nuevas: %. Mensajes en chat: %.',
    v_anfitrion_email,
    v_partido_id,
    v_insertadas,
    v_mensajes;
END $$;

-- Verificación
SELECT
  sp.id AS solicitud_id,
  sp.estado,
  e_sol.nombre AS equipo_solicitante,
  sol.full_name AS solicitante,
  (SELECT COUNT(*) FROM public.mensajes_solicitud m WHERE m.solicitud_id = sp.id) AS total_mensajes,
  host.email AS tu_correo,
  r.fecha_hora AS partido,
  c.nombre AS cancha
FROM public.solicitudes_partidos sp
JOIN public.partidos_abiertos pa ON pa.id = sp.partido_id
JOIN public.profiles host ON host.id = pa.creador_id
JOIN public.equipos e_sol ON e_sol.id = sp.equipo_solicitante_id
JOIN public.profiles sol ON sol.id = e_sol.creador_id
JOIN public.reservas r ON r.id = pa.reserva_id
JOIN public.canchas c ON c.id = r.cancha_id
WHERE sp.estado = 'pendiente'
  AND pa.estado = 'abierto'
ORDER BY sp.created_at DESC;
