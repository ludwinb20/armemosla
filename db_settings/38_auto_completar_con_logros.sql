-- Asegura que auto_completar_reservas evalúe logros al pasar reservas a completada.
-- Ejecutar si el cron completa reservas pero jugador_logro_progreso no se actualiza.
--
-- Causa habitual: solo se aplicó 12_reservas_auto_completar.sql (sin evaluar logros)
-- o se re-ejecutó 12 después de 32 y pisó la función.

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

DROP FUNCTION IF EXISTS public.auto_completar_reservas();

CREATE OR REPLACE FUNCTION public.auto_completar_reservas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_ids UUID[];
  v_reservas_actualizadas INTEGER := 0;
  v_jugadores_evaluados INTEGER := 0;
BEGIN
  WITH updated AS (
    UPDATE public.reservas
    SET estado = 'completada',
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE estado = 'pendiente'
      AND fecha_hora + INTERVAL '30 minutes' < TIMEZONE('utc'::text, NOW())
    RETURNING user_id, made_by_player
  )
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(
      array_agg(DISTINCT user_id) FILTER (
        WHERE user_id IS NOT NULL AND made_by_player = true
      ),
      ARRAY[]::UUID[]
    )
  INTO v_reservas_actualizadas, v_user_ids
  FROM updated;

  IF v_user_ids IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY v_user_ids LOOP
      PERFORM public.evaluar_logros_jugador(v_user_id);
      v_jugadores_evaluados := v_jugadores_evaluados + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reservas_actualizadas', v_reservas_actualizadas,
    'jugadores_evaluados', v_jugadores_evaluados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_completar_reservas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_completar_reservas() TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluar_logros_jugador(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluar_logros_jugador(UUID) TO service_role;

COMMENT ON FUNCTION public.auto_completar_reservas() IS
  'Marca pendientes vencidas como completada y evalúa logros (made_by_player=true). Cron/Edge Function.';

-- Recalcular todos los jugadores con reservas completadas (una vez, SQL Editor):
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
