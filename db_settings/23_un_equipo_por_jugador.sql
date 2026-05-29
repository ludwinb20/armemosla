-- Regla: un solo equipo por jugador
-- Ejecutar después de 15_equipos.sql

CREATE OR REPLACE FUNCTION public.ensure_one_team_per_player()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.jugador_equipos je
    WHERE je.jugador_id = NEW.jugador_id
      AND je.equipo_id <> NEW.equipo_id
  ) THEN
    RAISE EXCEPTION 'Solo se permite un equipo por jugador';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_one_team_per_player ON public.jugador_equipos;
CREATE TRIGGER enforce_one_team_per_player
  BEFORE INSERT ON public.jugador_equipos
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_one_team_per_player();

COMMENT ON FUNCTION public.ensure_one_team_per_player IS
  'Evita que un jugador sea miembro de más de un equipo';
