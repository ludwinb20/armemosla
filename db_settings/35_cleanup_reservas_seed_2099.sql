-- Elimina reservas de prueba con fecha en 2099 (seed antiguo) y recalcula progreso del logro
-- Ejecutar una vez si ves "viernes … 2099" en Mis Potras

DO $$
DECLARE
  v_jugador_email TEXT := 'lblancoorellana@gmail.com';
  v_user_id UUID;
  v_logro_id UUID;
  v_eliminadas INTEGER;
BEGIN
  SELECT p.id INTO v_user_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim(v_jugador_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', v_jugador_email;
  END IF;

  DELETE FROM public.reservas
  WHERE user_id = v_user_id
    AND made_by_player = true
    AND fecha_hora >= TIMESTAMPTZ '2099-01-01'
    AND fecha_hora < TIMESTAMPTZ '2100-01-01';

  GET DIAGNOSTICS v_eliminadas = ROW_COUNT;

  SELECT id INTO v_logro_id FROM public.logros WHERE codigo = 'fiel_a_la_cancha' LIMIT 1;

  IF v_logro_id IS NOT NULL THEN
    BEGIN
      PERFORM public.evaluar_logro(v_user_id, v_logro_id);
    EXCEPTION
      WHEN undefined_function THEN
        NULL;
    END;
  END IF;

  RAISE NOTICE 'Reservas 2099 eliminadas: %', v_eliminadas;
END $$;
