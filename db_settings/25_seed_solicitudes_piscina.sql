-- Solicitudes de reto (piscina) hacia partidos abiertos
-- Ejecutar en Supabase SQL Editor después de 16, 22 y 24 (o cuando ya tengas partidos en pool).
--
-- Por cada partido abierto, inserta 1–2 solicitudes pendientes de equipos que NO son
-- el anfitrión (creador del partido ni su mismo equipo publicado).
--
-- Opcional: limitar solo a TUS publicaciones (cambia el correo abajo).

DO $$
DECLARE
  -- NULL = solicitudes en TODOS los partidos abiertos del sistema
  -- 'tu@correo.com' = solo en partidos que publicaste tú en la piscina
  v_solo_creador_email TEXT := NULL;

  v_partido RECORD;
  v_equipo_id UUID;
  v_insertadas INTEGER := 0;
  v_mensajes TEXT[] := ARRAY[
    '¡Queremos el reto! ¿Nos vemos en la cancha?',
    'Tenemos equipo completo y ganas de jugar. ¿Aceptan?',
    'Saludos, buscamos rival para ese horario. ¿Les parece?'
  ];
  v_msg TEXT;
BEGIN
  FOR v_partido IN
    SELECT
      pa.id AS partido_id,
      pa.creador_id,
      pa.equipo_id AS equipo_anfitrion_id,
      p.email AS creador_email,
      p.full_name AS creador_nombre,
      e.nombre AS equipo_anfitrion,
      r.fecha_hora
    FROM public.partidos_abiertos pa
    JOIN public.reservas r ON r.id = pa.reserva_id
    JOIN public.profiles p ON p.id = pa.creador_id
    LEFT JOIN public.equipos e ON e.id = pa.equipo_id
    WHERE pa.estado = 'abierto'
      AND (
        v_solo_creador_email IS NULL
        OR lower(trim(p.email)) = lower(trim(v_solo_creador_email))
      )
    ORDER BY r.fecha_hora ASC
  LOOP
    -- Hasta 2 equipos rivales distintos por partido
    FOR v_equipo_id IN
      SELECT e.id
      FROM public.equipos e
      WHERE e.id IS DISTINCT FROM v_partido.equipo_anfitrion_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.jugador_equipos je
          WHERE je.equipo_id = e.id
            AND je.jugador_id = v_partido.creador_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.solicitudes_partidos sp
          WHERE sp.partido_id = v_partido.partido_id
            AND sp.equipo_solicitante_id = e.id
        )
      ORDER BY e.created_at ASC
      LIMIT 2
    LOOP
      v_msg := v_mensajes[1 + floor(random() * array_length(v_mensajes, 1))::int];

      INSERT INTO public.solicitudes_partidos (
        partido_id,
        equipo_solicitante_id,
        mensaje,
        estado
      )
      VALUES (
        v_partido.partido_id,
        v_equipo_id,
        v_msg,
        'pendiente'
      );

      v_insertadas := v_insertadas + 1;
    END LOOP;
  END LOOP;

  IF v_insertadas = 0 THEN
    RAISE NOTICE
      'No se insertó ninguna solicitud. ¿Tienes partidos con estado ''abierto'' en la piscina? Publica uno en Armemosla o ejecuta 24_seed_piscina_partidos.sql.';
  ELSE
    RAISE NOTICE 'Listo: % solicitud(es) pendiente(s) creada(s).', v_insertadas;
  END IF;
END $$;

-- Verificación: solicitudes recibidas por creador del partido
SELECT
  sp.id AS solicitud_id,
  sp.estado,
  sp.mensaje,
  sp.created_at,
  pa.id AS partido_id,
  host.full_name AS anfitrion,
  host.email AS anfitrion_email,
  e_host.nombre AS equipo_anfitrion,
  e_sol.nombre AS equipo_solicitante,
  r.fecha_hora,
  c.nombre AS cancha
FROM public.solicitudes_partidos sp
JOIN public.partidos_abiertos pa ON pa.id = sp.partido_id
JOIN public.profiles host ON host.id = pa.creador_id
LEFT JOIN public.equipos e_host ON e_host.id = pa.equipo_id
JOIN public.equipos e_sol ON e_sol.id = sp.equipo_solicitante_id
JOIN public.reservas r ON r.id = pa.reserva_id
JOIN public.canchas c ON c.id = r.cancha_id
WHERE sp.estado = 'pendiente'
  AND pa.estado = 'abierto'
ORDER BY sp.created_at DESC;
