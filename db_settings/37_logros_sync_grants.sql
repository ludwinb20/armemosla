-- Permisos y sincronización de logros tras auto-completar reservas
-- Ejecutar después de 32_logros_evaluacion.sql
-- Si la app muestra PGRST202, ver LOGROS_SETUP.md

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'evaluar_logros_jugador'
  ) THEN
    RAISE EXCEPTION
      'Falta evaluar_logros_jugador. Ejecutá primero db_settings/32_logros_evaluacion.sql (ver LOGROS_SETUP.md).';
  END IF;
END $$;
--
-- Sin esto, la app no puede recalcular progreso al abrir Logros si el trigger
-- no corrió (p. ej. migración 32 no aplicada o reservas ya insertadas como completada).

GRANT EXECUTE ON FUNCTION public.evaluar_logros_jugador(UUID) TO authenticated;

COMMENT ON FUNCTION public.evaluar_logros_jugador(UUID) IS
  'Recalcula progreso y recompensas del jugador autenticado (SECURITY DEFINER). Llamar desde app al abrir Logros.';

-- Recalcular progreso de todos los jugadores con reservas completadas (una vez, SQL Editor):
--
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT DISTINCT user_id
--     FROM public.reservas
--     WHERE made_by_player = true
--       AND estado = 'completada'
--       AND user_id IS NOT NULL
--   LOOP
--     PERFORM public.evaluar_logros_jugador(r.user_id);
--   END LOOP;
-- END $$;
--
-- Solo tu usuario (reemplazá el correo):
--
-- DO $$
-- DECLARE v_uid UUID;
-- BEGIN
--   SELECT id INTO v_uid FROM public.profiles
--   WHERE lower(trim(email)) = lower(trim('lblancoorellana@gmail.com'));
--   IF v_uid IS NOT NULL THEN
--     PERFORM public.evaluar_logros_jugador(v_uid);
--   END IF;
-- END $$;
