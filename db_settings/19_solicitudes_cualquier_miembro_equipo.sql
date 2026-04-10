-- Permitir que cualquier jugador miembro de un equipo envíe solicitud de reto
-- (antes el WITH CHECK exigía ser creador del equipo, incompatible con jugador_equipos).
-- Ejecutar en Supabase SQL después de 16_partidos_abiertos.sql

DROP POLICY IF EXISTS "Players can create solicitudes" ON public.solicitudes_partidos;

CREATE POLICY "Players can create solicitudes"
  ON public.solicitudes_partidos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Jugador'
    )
    AND EXISTS (
      SELECT 1 FROM public.jugador_equipos je
      WHERE je.equipo_id = solicitudes_partidos.equipo_solicitante_id
      AND je.jugador_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.partidos_abiertos pa
      WHERE pa.id = solicitudes_partidos.partido_id
      AND pa.estado = 'abierto'
      AND pa.equipo_id IS DISTINCT FROM solicitudes_partidos.equipo_solicitante_id
    )
  );
