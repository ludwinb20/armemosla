-- Diagnóstico: por qué "Fiel a la cancha" no sube después del seed 19/20
-- Ejecutar en Supabase SQL Editor (cambia el email en v_email si hace falta).

DO $$
DECLARE
  v_email TEXT := 'lblancoorellana@gmail.com';
  v_user_id UUID;
  v_cancha_logro UUID;
BEGIN
  SELECT p.id INTO v_user_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim(v_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró jugador con email %', v_email;
  END IF;

  SELECT (jlp.metadata->>'cancha_id')::UUID INTO v_cancha_logro
  FROM public.jugador_logro_progreso jlp
  JOIN public.logros l ON l.id = jlp.logro_id
  WHERE l.codigo = 'fiel_a_la_cancha'
    AND jlp.user_id = v_user_id
  LIMIT 1;

  RAISE NOTICE '--- Progreso guardado ---';
  PERFORM 1;
END $$;

-- 1) Progreso guardado y cancha objetivo del logro
SELECT
  p.email,
  l.titulo,
  jlp.valor_actual,
  jlp.valor_meta,
  jlp.metadata->>'cancha_id' AS cancha_id_logro,
  c.nombre AS cancha_nombre_logro,
  co.nombre AS complejo_logro
FROM public.jugador_logro_progreso jlp
JOIN public.profiles p ON p.id = jlp.user_id
JOIN public.logros l ON l.id = jlp.logro_id
LEFT JOIN public.canchas c ON c.id = (jlp.metadata->>'cancha_id')::UUID
LEFT JOIN public.complejos co ON co.id = c.complejo_id
WHERE l.codigo = 'fiel_a_la_cancha'
  AND lower(trim(p.email)) = lower(trim('lblancoorellana@gmail.com'));

-- 2) Conteo por cancha (solo reservas que CUENTAN para logros)
SELECT
  c.nombre,
  co.nombre AS complejo,
  r.cancha_id,
  COUNT(*) AS completadas_que_cuentan
FROM public.reservas r
JOIN public.canchas c ON c.id = r.cancha_id
JOIN public.complejos co ON co.id = c.complejo_id
WHERE r.user_id = (
  SELECT id FROM public.profiles
  WHERE lower(trim(email)) = lower(trim('lblancoorellana@gmail.com'))
  LIMIT 1
)
  AND r.made_by_player = true
  AND r.estado = 'completada'
GROUP BY c.nombre, co.nombre, r.cancha_id
ORDER BY completadas_que_cuentan DESC;

-- 3) Últimas 25 reservas: cuáles suman y cuáles no
SELECT
  r.fecha_hora,
  c.nombre AS cancha,
  co.nombre AS complejo,
  r.estado,
  r.made_by_player,
  r.cancha_id,
  CASE
    WHEN r.made_by_player = false THEN 'NO cuenta: reserva de admin (Home/Reservas)'
    WHEN r.estado <> 'completada' THEN 'NO cuenta: aún pendiente (esperá 30 min post horario + cron)'
    WHEN r.cancha_id IS DISTINCT FROM (
      SELECT (jlp.metadata->>'cancha_id')::UUID
      FROM public.jugador_logro_progreso jlp
      JOIN public.logros l ON l.id = jlp.logro_id
      WHERE l.codigo = 'fiel_a_la_cancha'
        AND jlp.user_id = r.user_id
      LIMIT 1
    ) THEN 'NO suma a Fiel: es otra cancha (aunque se llame igual)'
    ELSE 'SÍ cuenta para Fiel a la cancha'
  END AS motivo
FROM public.reservas r
JOIN public.canchas c ON c.id = r.cancha_id
JOIN public.complejos co ON co.id = c.complejo_id
WHERE r.user_id = (
  SELECT id FROM public.profiles
  WHERE lower(trim(email)) = lower(trim('lblancoorellana@gmail.com'))
  LIMIT 1
)
ORDER BY r.fecha_hora DESC
LIMIT 25;

-- 4) Forzar recálculo (después de revisar filas arriba)
-- SELECT public.evaluar_logros_jugador(
--   (SELECT id FROM public.profiles WHERE lower(trim(email)) = lower(trim('lblancoorellana@gmail.com')) LIMIT 1)
-- );
