-- Mensajes de texto por solicitud de partido (chat básico)
-- Ejecutar después de 16_partidos_abiertos.sql y 19_solicitudes_cualquier_miembro_equipo.sql

CREATE TABLE IF NOT EXISTS public.mensajes_solicitud (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  solicitud_id UUID NOT NULL REFERENCES public.solicitudes_partidos(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mensajes_solicitud_solicitud_id
  ON public.mensajes_solicitud(solicitud_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_solicitud_solicitud_created
  ON public.mensajes_solicitud(solicitud_id, created_at DESC);

ALTER TABLE public.mensajes_solicitud ENABLE ROW LEVEL SECURITY;

-- Participantes: creador del partido o miembros del equipo solicitante / anfitrión
CREATE OR REPLACE FUNCTION public.puede_acceder_solicitud_partido(p_solicitud_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.solicitudes_partidos sp
    INNER JOIN public.partidos_abiertos pa ON pa.id = sp.partido_id
    WHERE sp.id = p_solicitud_id
      AND (
        pa.creador_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.jugador_equipos je
          WHERE je.jugador_id = auth.uid()
            AND je.equipo_id = sp.equipo_solicitante_id
        )
        OR EXISTS (
          SELECT 1 FROM public.jugador_equipos je
          WHERE je.jugador_id = auth.uid()
            AND je.equipo_id = pa.equipo_id
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Participants can view mensajes_solicitud" ON public.mensajes_solicitud;
CREATE POLICY "Participants can view mensajes_solicitud"
  ON public.mensajes_solicitud
  FOR SELECT
  USING (public.puede_acceder_solicitud_partido(solicitud_id));

DROP POLICY IF EXISTS "Participants can send mensajes_solicitud" ON public.mensajes_solicitud;
CREATE POLICY "Participants can send mensajes_solicitud"
  ON public.mensajes_solicitud
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.puede_acceder_solicitud_partido(solicitud_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'Jugador'
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_solicitud;

COMMENT ON TABLE public.mensajes_solicitud IS
  'Mensajes de texto en conversaciones ligadas a solicitudes_partidos';
