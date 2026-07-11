-- Respuesta a retos directos (aceptar / rechazar / cancelar)
-- Ejecutar después de 21_retos_directos_jugadores.sql y 54_push_notifications.sql

-- Push de respuesta se envía desde la app (dispatch-notification); evitar duplicados con outbox/cron.
DROP TRIGGER IF EXISTS push_reto_directo_respuesta ON public.retos_directos_jugador;

CREATE OR REPLACE FUNCTION public.aceptar_reto_directo_jugador(p_reto_id UUID)
RETURNS public.retos_directos_jugador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reto public.retos_directos_jugador;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT * INTO v_reto
  FROM public.retos_directos_jugador
  WHERE id = p_reto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reto no encontrado';
  END IF;

  IF v_reto.jugador_objetivo_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el jugador invitado puede aceptar este reto';
  END IF;

  IF v_reto.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Este reto ya no está pendiente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.id = v_reto.reserva_id
      AND r.estado = 'pendiente'
      AND r.made_by_player = true
  ) THEN
    RAISE EXCEPTION 'La reserva ya no está disponible para confirmar rival';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.retos_directos_jugador rd
    WHERE rd.reserva_id = v_reto.reserva_id
      AND rd.estado = 'aceptado'
      AND rd.id <> p_reto_id
  ) THEN
    RAISE EXCEPTION 'Esta reserva ya tiene un rival confirmado';
  END IF;

  UPDATE public.retos_directos_jugador
  SET estado = 'aceptado', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_reto_id;

  UPDATE public.retos_directos_jugador
  SET estado = 'rechazado', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE reserva_id = v_reto.reserva_id
    AND id <> p_reto_id
    AND estado = 'pendiente';

  SELECT * INTO v_reto FROM public.retos_directos_jugador WHERE id = p_reto_id;
  RETURN v_reto;
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_reto_directo_jugador(p_reto_id UUID)
RETURNS public.retos_directos_jugador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reto public.retos_directos_jugador;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT * INTO v_reto
  FROM public.retos_directos_jugador
  WHERE id = p_reto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reto no encontrado';
  END IF;

  IF v_reto.jugador_objetivo_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el jugador invitado puede rechazar este reto';
  END IF;

  IF v_reto.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Este reto ya no está pendiente';
  END IF;

  UPDATE public.retos_directos_jugador
  SET estado = 'rechazado', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_reto_id;

  SELECT * INTO v_reto FROM public.retos_directos_jugador WHERE id = p_reto_id;
  RETURN v_reto;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_reto_directo_jugador(p_reto_id UUID)
RETURNS public.retos_directos_jugador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reto public.retos_directos_jugador;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT * INTO v_reto
  FROM public.retos_directos_jugador
  WHERE id = p_reto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reto no encontrado';
  END IF;

  IF v_reto.creador_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo quien envió el reto puede cancelarlo';
  END IF;

  IF v_reto.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar retos pendientes';
  END IF;

  UPDATE public.retos_directos_jugador
  SET estado = 'cancelado', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_reto_id;

  SELECT * INTO v_reto FROM public.retos_directos_jugador WHERE id = p_reto_id;
  RETURN v_reto;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceptar_reto_directo_jugador(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_reto_directo_jugador(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_reto_directo_jugador(UUID) TO authenticated;

COMMENT ON FUNCTION public.aceptar_reto_directo_jugador IS 'El invitado confirma rival; rechaza otros retos pendientes de la misma reserva';
COMMENT ON FUNCTION public.rechazar_reto_directo_jugador IS 'El invitado rechaza un reto directo pendiente';
COMMENT ON FUNCTION public.cancelar_reto_directo_jugador IS 'El creador cancela su invitación pendiente';
