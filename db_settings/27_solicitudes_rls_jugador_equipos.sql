-- Ampliar SELECT/UPDATE de solicitudes_partidos a cualquier miembro del equipo (jugador_equipos)
-- Ejecutar después de 19_solicitudes_cualquier_miembro_equipo.sql

DROP POLICY IF EXISTS "Players can view related solicitudes" ON public.solicitudes_partidos;
CREATE POLICY "Players can view related solicitudes"
  ON public.solicitudes_partidos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partidos_abiertos pa
      WHERE pa.id = solicitudes_partidos.partido_id
        AND pa.creador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.jugador_equipos je
      WHERE je.jugador_id = auth.uid()
        AND je.equipo_id = solicitudes_partidos.equipo_solicitante_id
    )
    OR EXISTS (
      SELECT 1 FROM public.partidos_abiertos pa
      INNER JOIN public.jugador_equipos je ON je.equipo_id = pa.equipo_id
      WHERE pa.id = solicitudes_partidos.partido_id
        AND je.jugador_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can update related solicitudes" ON public.solicitudes_partidos;
CREATE POLICY "Players can update related solicitudes"
  ON public.solicitudes_partidos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partidos_abiertos pa
      WHERE pa.id = solicitudes_partidos.partido_id
        AND pa.creador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.jugador_equipos je
      WHERE je.jugador_id = auth.uid()
        AND je.equipo_id = solicitudes_partidos.equipo_solicitante_id
    )
  );
