-- Invitaciones directas de reto a jugadores
-- Ejecutar después de 11_reservas.sql, 15_equipos.sql y 16_partidos_abiertos.sql

CREATE TABLE IF NOT EXISTS public.retos_directos_jugador (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reserva_id UUID REFERENCES public.reservas(id) ON DELETE CASCADE NOT NULL,
  creador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  jugador_objetivo_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mensaje TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptado', 'rechazado', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(reserva_id, jugador_objetivo_id)
);

CREATE INDEX IF NOT EXISTS idx_retos_directos_creador_id ON public.retos_directos_jugador(creador_id);
CREATE INDEX IF NOT EXISTS idx_retos_directos_objetivo_id ON public.retos_directos_jugador(jugador_objetivo_id);
CREATE INDEX IF NOT EXISTS idx_retos_directos_reserva_id ON public.retos_directos_jugador(reserva_id);
CREATE INDEX IF NOT EXISTS idx_retos_directos_estado ON public.retos_directos_jugador(estado);

ALTER TABLE public.retos_directos_jugador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view own direct retos" ON public.retos_directos_jugador;
CREATE POLICY "Players can view own direct retos"
  ON public.retos_directos_jugador
  FOR SELECT
  USING (creador_id = auth.uid() OR jugador_objetivo_id = auth.uid());

DROP POLICY IF EXISTS "Players can create own direct retos" ON public.retos_directos_jugador;
CREATE POLICY "Players can create own direct retos"
  ON public.retos_directos_jugador
  FOR INSERT
  WITH CHECK (
    creador_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Jugador'
    )
  );

DROP POLICY IF EXISTS "Players can update own direct retos" ON public.retos_directos_jugador;
CREATE POLICY "Players can update own direct retos"
  ON public.retos_directos_jugador
  FOR UPDATE
  USING (creador_id = auth.uid() OR jugador_objetivo_id = auth.uid());

DROP TRIGGER IF EXISTS set_retos_directos_jugador_updated_at ON public.retos_directos_jugador;
CREATE TRIGGER set_retos_directos_jugador_updated_at
  BEFORE UPDATE ON public.retos_directos_jugador
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Candidatos para ofrecer reto:
-- ordena por cantidad de complejos en común con el jugador autenticado.
CREATE OR REPLACE FUNCTION public.listar_jugadores_para_reto(
  p_reserva_id UUID,
  p_limit INTEGER DEFAULT 15,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  jugador_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  equipo_id UUID,
  equipo_nombre TEXT,
  equipo_logo_url TEXT,
  equipo_nombre_visible TEXT,
  complejos_en_comun INTEGER,
  ya_invitado BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reserva_owner AS (
    SELECT r.id, r.user_id
    FROM public.reservas r
    WHERE r.id = p_reserva_id
      AND r.user_id = auth.uid()
    LIMIT 1
  ),
  my_complexes AS (
    SELECT DISTINCT c.complejo_id
    FROM public.reservas r
    JOIN public.canchas c ON c.id = r.cancha_id
    WHERE r.user_id = auth.uid()
      AND r.estado IN ('pendiente', 'completada')
      AND EXISTS (SELECT 1 FROM reserva_owner)
  ),
  players AS (
    SELECT p.id, p.full_name, p.avatar_url
    FROM public.profiles p
    WHERE p.user_type = 'Jugador'
      AND p.id <> auth.uid()
      AND EXISTS (SELECT 1 FROM reserva_owner)
  ),
  players_complex_match AS (
    SELECT r.user_id AS jugador_id, COUNT(DISTINCT c.complejo_id)::INTEGER AS score
    FROM public.reservas r
    JOIN public.canchas c ON c.id = r.cancha_id
    JOIN my_complexes mc ON mc.complejo_id = c.complejo_id
    WHERE r.estado IN ('pendiente', 'completada')
    GROUP BY r.user_id
  ),
  players_team AS (
    SELECT
      p.id AS jugador_id,
      e.id AS equipo_id,
      e.nombre AS equipo_nombre,
      e.logo_url AS equipo_logo_url
    FROM players p
    LEFT JOIN LATERAL (
      SELECT je.equipo_id
      FROM public.jugador_equipos je
      WHERE je.jugador_id = p.id
      ORDER BY je.es_principal DESC, je.created_at ASC
      LIMIT 1
    ) je_best ON true
    LEFT JOIN public.equipos e ON e.id = je_best.equipo_id
  )
  SELECT
    p.id AS jugador_id,
    p.full_name,
    p.avatar_url,
    pt.equipo_id,
    pt.equipo_nombre,
    pt.equipo_logo_url,
    COALESCE(pt.equipo_nombre, 'Equipo de ' || COALESCE(NULLIF(p.full_name, ''), 'Jugador')) AS equipo_nombre_visible,
    COALESCE(pcm.score, 0) AS complejos_en_comun,
    EXISTS (
      SELECT 1
      FROM public.retos_directos_jugador rd
      WHERE rd.reserva_id = p_reserva_id
        AND rd.jugador_objetivo_id = p.id
        AND rd.estado IN ('pendiente', 'aceptado')
    ) AS ya_invitado
  FROM players p
  LEFT JOIN players_complex_match pcm ON pcm.jugador_id = p.id
  LEFT JOIN players_team pt ON pt.jugador_id = p.id
  ORDER BY COALESCE(pcm.score, 0) DESC, p.full_name ASC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 15), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- Crea/actualiza una oferta directa de reto a un jugador.
CREATE OR REPLACE FUNCTION public.crear_reto_directo_jugador(
  p_reserva_id UUID,
  p_jugador_objetivo_id UUID,
  p_mensaje TEXT DEFAULT NULL
)
RETURNS public.retos_directos_jugador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.retos_directos_jugador;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_jugador_objetivo_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes retarte a ti mismo';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.reservas r
    WHERE r.id = p_reserva_id
      AND r.user_id = auth.uid()
      AND r.estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Reserva inválida para ofrecer reto';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_jugador_objetivo_id
      AND p.user_type = 'Jugador'
  ) THEN
    RAISE EXCEPTION 'Jugador destino inválido';
  END IF;

  INSERT INTO public.retos_directos_jugador (
    reserva_id,
    creador_id,
    jugador_objetivo_id,
    mensaje,
    estado
  )
  VALUES (
    p_reserva_id,
    auth.uid(),
    p_jugador_objetivo_id,
    NULLIF(TRIM(COALESCE(p_mensaje, '')), ''),
    'pendiente'
  )
  ON CONFLICT (reserva_id, jugador_objetivo_id)
  DO UPDATE SET
    mensaje = COALESCE(EXCLUDED.mensaje, public.retos_directos_jugador.mensaje),
    estado = 'pendiente',
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_jugadores_para_reto(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_reto_directo_jugador(UUID, UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.retos_directos_jugador IS 'Invitaciones directas de un jugador a otro para una reserva pendiente';
COMMENT ON FUNCTION public.listar_jugadores_para_reto IS 'Lista jugadores candidatos ordenados por complejos en común con paginación';
COMMENT ON FUNCTION public.crear_reto_directo_jugador IS 'Crea o reactiva una invitación directa de reto para una reserva';
