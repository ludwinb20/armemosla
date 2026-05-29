-- Última lectura por usuario en cada conversación de solicitud
-- Ejecutar después de 26_mensajes_solicitud.sql

CREATE TABLE IF NOT EXISTS public.solicitud_lecturas (
  solicitud_id UUID NOT NULL REFERENCES public.solicitudes_partidos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (solicitud_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_solicitud_lecturas_user_id
  ON public.solicitud_lecturas(user_id);

ALTER TABLE public.solicitud_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own solicitud_lecturas" ON public.solicitud_lecturas;
CREATE POLICY "Users manage own solicitud_lecturas"
  ON public.solicitud_lecturas
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.puede_acceder_solicitud_partido(solicitud_id)
  );

COMMENT ON TABLE public.solicitud_lecturas IS
  'Marca de lectura por jugador en conversaciones de solicitudes_partidos';
