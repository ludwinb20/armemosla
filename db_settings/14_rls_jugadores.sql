-- Políticas RLS para que jugadores puedan ver complejos y canchas públicos
-- Ejecutar después de 07_canchas.sql, 08_cancha_fotos.sql y 06_add_activo_to_complejos.sql

-- Políticas para complejos: Jugadores pueden ver complejos activos públicos
CREATE POLICY "Players can view active complejos"
  ON public.complejos
  FOR SELECT
  USING (
    activo = true AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Jugador'
    )
  );

-- Políticas para fotos de complejos: Jugadores pueden ver fotos de complejos activos
CREATE POLICY "Players can view active complejo fotos"
  ON public.complejo_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      INNER JOIN public.profiles ON profiles.id = auth.uid()
      WHERE complejos.id = complejo_fotos.complejo_id
      AND complejos.activo = true
      AND profiles.user_type = 'Jugador'
    )
  );

-- Políticas para canchas: Jugadores pueden ver canchas activas de complejos activos
CREATE POLICY "Players can view active canchas"
  ON public.canchas
  FOR SELECT
  USING (
    activo = true AND
    EXISTS (
      SELECT 1 FROM public.complejos
      INNER JOIN public.profiles ON profiles.id = auth.uid()
      WHERE complejos.id = canchas.complejo_id
      AND complejos.activo = true
      AND profiles.user_type = 'Jugador'
    )
  );

-- Políticas para fotos de canchas: Jugadores pueden ver fotos de canchas activas
-- (Ejecutar después de 08_cancha_fotos.sql)
-- Eliminar política si existe antes de crearla
DROP POLICY IF EXISTS "Players can view active cancha fotos" ON public.cancha_fotos;

CREATE POLICY "Players can view active cancha fotos"
  ON public.cancha_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      INNER JOIN public.profiles ON profiles.id = auth.uid()
      WHERE canchas.id = cancha_fotos.cancha_id
      AND canchas.activo = true
      AND complejos.activo = true
      AND profiles.user_type = 'Jugador'
    )
  );

-- Comentarios para documentación
COMMENT ON POLICY "Players can view active complejos" ON public.complejos IS 
  'Permite a los jugadores ver complejos deportivos que están activos y públicos';

COMMENT ON POLICY "Players can view active canchas" ON public.canchas IS 
  'Permite a los jugadores ver canchas activas que pertenecen a complejos activos';
