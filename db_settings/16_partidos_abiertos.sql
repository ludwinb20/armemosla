-- Tabla de partidos abiertos y solicitudes
-- Ejecutar después de 11_reservas.sql y 15_equipos.sql

-- Tabla de partidos abiertos
CREATE TABLE IF NOT EXISTS public.partidos_abiertos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reserva_id UUID REFERENCES public.reservas(id) ON DELETE CASCADE NOT NULL,
  creador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  equipo_id UUID REFERENCES public.equipos(id) ON DELETE SET NULL, -- equipo que busca rival
  jugadores_necesarios INTEGER NOT NULL CHECK (jugadores_necesarios > 0), -- número de jugadores que busca
  busca_automatico BOOLEAN DEFAULT false, -- si busca matching automático
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_negociacion', 'confirmado', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(reserva_id) -- Un partido abierto por reserva
);

-- Tabla de solicitudes de partidos
CREATE TABLE IF NOT EXISTS public.solicitudes_partidos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  partido_id UUID REFERENCES public.partidos_abiertos(id) ON DELETE CASCADE NOT NULL,
  equipo_solicitante_id UUID REFERENCES public.equipos(id) ON DELETE SET NULL,
  mensaje TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_partidos_abiertos_reserva_id ON public.partidos_abiertos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_partidos_abiertos_creador_id ON public.partidos_abiertos(creador_id);
CREATE INDEX IF NOT EXISTS idx_partidos_abiertos_equipo_id ON public.partidos_abiertos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_abiertos_estado ON public.partidos_abiertos(estado);
CREATE INDEX IF NOT EXISTS idx_partidos_abiertos_busca_automatico ON public.partidos_abiertos(busca_automatico) WHERE busca_automatico = true;
CREATE INDEX IF NOT EXISTS idx_partidos_abiertos_estado_abierto ON public.partidos_abiertos(estado) WHERE estado = 'abierto';

CREATE INDEX IF NOT EXISTS idx_solicitudes_partido_id ON public.solicitudes_partidos(partido_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_equipo_solicitante_id ON public.solicitudes_partidos(equipo_solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON public.solicitudes_partidos(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_pendientes ON public.solicitudes_partidos(partido_id, estado) WHERE estado = 'pendiente';

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.partidos_abiertos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_partidos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para partidos_abiertos
-- Cualquiera puede ver partidos abiertos activos (para buscar rivales)
-- El creador puede ver todos sus partidos (incluso cancelados)
DROP POLICY IF EXISTS "Anyone can view open partidos_abiertos" ON public.partidos_abiertos;
CREATE POLICY "Anyone can view open partidos_abiertos"
  ON public.partidos_abiertos
  FOR SELECT
  USING (
    estado IN ('abierto', 'en_negociacion')
    OR creador_id = auth.uid()
  );

-- Los jugadores pueden crear partidos abiertos
DROP POLICY IF EXISTS "Players can create partidos_abiertos" ON public.partidos_abiertos;
CREATE POLICY "Players can create partidos_abiertos"
  ON public.partidos_abiertos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Jugador'
    )
    AND creador_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reservas
      WHERE reservas.id = reserva_id
      AND reservas.user_id = auth.uid()
      AND reservas.estado = 'pendiente'
    )
  );

-- Los creadores pueden actualizar sus partidos abiertos
DROP POLICY IF EXISTS "Creators can update own partidos_abiertos" ON public.partidos_abiertos;
CREATE POLICY "Creators can update own partidos_abiertos"
  ON public.partidos_abiertos
  FOR UPDATE
  USING (creador_id = auth.uid());

-- Los creadores pueden eliminar/cancelar sus partidos abiertos
DROP POLICY IF EXISTS "Creators can delete own partidos_abiertos" ON public.partidos_abiertos;
CREATE POLICY "Creators can delete own partidos_abiertos"
  ON public.partidos_abiertos
  FOR DELETE
  USING (creador_id = auth.uid());

-- Políticas RLS para solicitudes_partidos
-- Los jugadores pueden ver solicitudes relacionadas con sus equipos
-- Simplificamos para evitar recursión: verificamos directamente el creador del partido
-- o si el usuario pertenece al equipo solicitante o al equipo del partido
DROP POLICY IF EXISTS "Players can view related solicitudes" ON public.solicitudes_partidos;
CREATE POLICY "Players can view related solicitudes"
  ON public.solicitudes_partidos
  FOR SELECT
  USING (
    -- El creador del partido puede ver todas las solicitudes
    EXISTS (
      SELECT 1 FROM public.partidos_abiertos
      WHERE partidos_abiertos.id = solicitudes_partidos.partido_id
      AND partidos_abiertos.creador_id = auth.uid()
    )
    -- O si el usuario pertenece al equipo solicitante
    OR EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = solicitudes_partidos.equipo_solicitante_id
      AND equipos.creador_id = auth.uid()
    )
    -- O si el usuario pertenece al equipo del partido (a través de jugador_equipos, pero sin recursión)
    OR EXISTS (
      SELECT 1 FROM public.partidos_abiertos pa
      INNER JOIN public.equipos e ON e.id = pa.equipo_id
      WHERE pa.id = solicitudes_partidos.partido_id
      AND e.creador_id = auth.uid()
    )
  );

-- Los jugadores pueden enviar solicitudes desde sus equipos
-- Simplificamos: solo el creador del equipo puede enviar solicitudes (evitamos recursión con jugador_equipos)
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
    -- Solo el creador del equipo puede enviar solicitudes
    AND EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = solicitudes_partidos.equipo_solicitante_id
      AND equipos.creador_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.partidos_abiertos
      WHERE partidos_abiertos.id = solicitudes_partidos.partido_id
      AND partidos_abiertos.estado = 'abierto'
      AND partidos_abiertos.equipo_id != solicitudes_partidos.equipo_solicitante_id
    )
  );

-- Los creadores del partido pueden aceptar/rechazar solicitudes
-- Los creadores del equipo solicitante pueden cancelarla
-- Simplificamos: solo el creador del equipo puede actualizar (evitamos recursión)
DROP POLICY IF EXISTS "Players can update related solicitudes" ON public.solicitudes_partidos;
CREATE POLICY "Players can update related solicitudes"
  ON public.solicitudes_partidos
  FOR UPDATE
  USING (
    -- El creador del partido puede aceptar/rechazar
    EXISTS (
      SELECT 1 FROM public.partidos_abiertos
      WHERE partidos_abiertos.id = solicitudes_partidos.partido_id
      AND partidos_abiertos.creador_id = auth.uid()
    )
    -- O el creador del equipo solicitante puede cancelar
    OR EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = solicitudes_partidos.equipo_solicitante_id
      AND equipos.creador_id = auth.uid()
    )
  );

-- Los creadores pueden eliminar solicitudes
DROP POLICY IF EXISTS "Players can delete related solicitudes" ON public.solicitudes_partidos;
CREATE POLICY "Players can delete related solicitudes"
  ON public.solicitudes_partidos
  FOR DELETE
  USING (
    -- El creador del partido puede eliminar
    EXISTS (
      SELECT 1 FROM public.partidos_abiertos
      WHERE partidos_abiertos.id = solicitudes_partidos.partido_id
      AND partidos_abiertos.creador_id = auth.uid()
    )
    -- O el creador del equipo solicitante puede eliminar
    OR EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = solicitudes_partidos.equipo_solicitante_id
      AND equipos.creador_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS set_partidos_abiertos_updated_at ON public.partidos_abiertos;
CREATE TRIGGER set_partidos_abiertos_updated_at
  BEFORE UPDATE ON public.partidos_abiertos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_solicitudes_updated_at ON public.solicitudes_partidos;
CREATE TRIGGER set_solicitudes_updated_at
  BEFORE UPDATE ON public.solicitudes_partidos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Función RPC para calcular distancia entre coordenadas (fórmula de Haversine)
CREATE OR REPLACE FUNCTION public.calcular_distancia(
  lat1 DECIMAL,
  lng1 DECIMAL,
  lat2 DECIMAL,
  lng2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  earth_radius DECIMAL := 6371; -- Radio de la Tierra en km
  dlat DECIMAL;
  dlng DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  -- Convertir grados a radianes
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  
  -- Fórmula de Haversine
  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlng/2) * sin(dlng/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comentarios para documentación
COMMENT ON TABLE public.partidos_abiertos IS 'Partidos abiertos donde equipos buscan rivales';
COMMENT ON COLUMN public.partidos_abiertos.reserva_id IS 'Reserva asociada al partido';
COMMENT ON COLUMN public.partidos_abiertos.equipo_id IS 'Equipo que busca rival';
COMMENT ON COLUMN public.partidos_abiertos.jugadores_necesarios IS 'Número de jugadores que se buscan';
COMMENT ON COLUMN public.partidos_abiertos.busca_automatico IS 'Si el sistema debe buscar match automático';
COMMENT ON TABLE public.solicitudes_partidos IS 'Solicitudes de equipos para jugar un partido abierto';
COMMENT ON FUNCTION public.calcular_distancia IS 'Calcula la distancia en km entre dos puntos geográficos usando la fórmula de Haversine';
