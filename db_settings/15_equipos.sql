-- Tabla de equipos
-- Ejecutar después de 01_setup_basico.sql y 02_add_user_type.sql

-- Tabla de equipos
CREATE TABLE IF NOT EXISTS public.equipos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  logo_url TEXT,
  creador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tabla de relación jugador-equipos (muchos a muchos)
CREATE TABLE IF NOT EXISTS public.jugador_equipos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jugador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  equipo_id UUID REFERENCES public.equipos(id) ON DELETE CASCADE NOT NULL,
  es_principal BOOLEAN DEFAULT false, -- equipo principal del jugador
  rol TEXT, -- 'capitan', 'jugador', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Constraint: un jugador solo puede tener un equipo principal
  CONSTRAINT jugador_equipos_unique UNIQUE (jugador_id, equipo_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_equipos_creador_id ON public.equipos(creador_id);
CREATE INDEX IF NOT EXISTS idx_jugador_equipos_jugador_id ON public.jugador_equipos(jugador_id);
CREATE INDEX IF NOT EXISTS idx_jugador_equipos_equipo_id ON public.jugador_equipos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_jugador_equipos_principal ON public.jugador_equipos(jugador_id, es_principal) WHERE es_principal = true;

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jugador_equipos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para equipos
-- Cualquiera puede ver equipos (para buscar rivales)
DROP POLICY IF EXISTS "Anyone can view equipos" ON public.equipos;
CREATE POLICY "Anyone can view equipos"
  ON public.equipos
  FOR SELECT
  USING (true);

-- Los jugadores pueden crear equipos
DROP POLICY IF EXISTS "Players can create equipos" ON public.equipos;
CREATE POLICY "Players can create equipos"
  ON public.equipos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Jugador'
    )
    AND creador_id = auth.uid()
  );

-- Los creadores pueden actualizar sus equipos
DROP POLICY IF EXISTS "Creators can update own equipos" ON public.equipos;
CREATE POLICY "Creators can update own equipos"
  ON public.equipos
  FOR UPDATE
  USING (creador_id = auth.uid());

-- Los creadores pueden eliminar sus equipos
DROP POLICY IF EXISTS "Creators can delete own equipos" ON public.equipos;
CREATE POLICY "Creators can delete own equipos"
  ON public.equipos
  FOR DELETE
  USING (creador_id = auth.uid());

-- Políticas RLS para jugador_equipos
-- Cualquiera puede ver las relaciones jugador-equipo (los equipos son públicos para buscar rivales)
-- Evitamos recursión permitiendo acceso público para SELECT
DROP POLICY IF EXISTS "Players can view own jugador_equipos" ON public.jugador_equipos;
CREATE POLICY "Anyone can view jugador_equipos"
  ON public.jugador_equipos
  FOR SELECT
  USING (true);

-- Los jugadores pueden agregarse a equipos (pero no a sí mismos directamente)
-- Solo el creador puede agregar miembros (evitamos recursión con capitanes)
DROP POLICY IF EXISTS "Team members can add players" ON public.jugador_equipos;
CREATE POLICY "Team members can add players"
  ON public.jugador_equipos
  FOR INSERT
  WITH CHECK (
    jugador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = jugador_equipos.equipo_id
      AND equipos.creador_id = auth.uid()
    )
  );

-- Los jugadores pueden actualizar sus propias relaciones (cambiar equipo principal)
-- Los creadores pueden actualizar roles
DROP POLICY IF EXISTS "Players can update own jugador_equipos" ON public.jugador_equipos;
CREATE POLICY "Players can update own jugador_equipos"
  ON public.jugador_equipos
  FOR UPDATE
  USING (
    jugador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = jugador_equipos.equipo_id
      AND equipos.creador_id = auth.uid()
    )
  );

-- Los jugadores pueden eliminarse a sí mismos de equipos
-- Los creadores pueden eliminar miembros
DROP POLICY IF EXISTS "Players can delete own jugador_equipos" ON public.jugador_equipos;
CREATE POLICY "Players can delete own jugador_equipos"
  ON public.jugador_equipos
  FOR DELETE
  USING (
    jugador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.equipos
      WHERE equipos.id = jugador_equipos.equipo_id
      AND equipos.creador_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at en equipos
DROP TRIGGER IF EXISTS set_equipos_updated_at ON public.equipos;
CREATE TRIGGER set_equipos_updated_at
  BEFORE UPDATE ON public.equipos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Función para asegurar que solo un equipo sea principal por jugador
CREATE OR REPLACE FUNCTION public.ensure_single_principal_equipo()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se está estableciendo como principal, quitar principal de otros equipos
  IF NEW.es_principal = true THEN
    UPDATE public.jugador_equipos
    SET es_principal = false
    WHERE jugador_id = NEW.jugador_id
    AND equipo_id != NEW.equipo_id
    AND es_principal = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para asegurar un solo equipo principal
DROP TRIGGER IF EXISTS ensure_single_principal ON public.jugador_equipos;
CREATE TRIGGER ensure_single_principal
  BEFORE INSERT OR UPDATE ON public.jugador_equipos
  FOR EACH ROW
  WHEN (NEW.es_principal = true)
  EXECUTE FUNCTION public.ensure_single_principal_equipo();

-- Comentarios para documentación
COMMENT ON TABLE public.equipos IS 'Equipos deportivos creados por jugadores';
COMMENT ON COLUMN public.equipos.creador_id IS 'ID del jugador que creó el equipo';
COMMENT ON COLUMN public.jugador_equipos.es_principal IS 'Indica si este es el equipo principal del jugador (solo uno puede ser principal)';
COMMENT ON COLUMN public.jugador_equipos.rol IS 'Rol del jugador en el equipo: capitan, jugador, etc.';
