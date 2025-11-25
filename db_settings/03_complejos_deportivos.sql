-- Tabla de complejos deportivos
-- Ejecutar después de 01_setup_basico.sql y 02_add_user_type.sql

-- Tabla de complejos deportivos
CREATE TABLE IF NOT EXISTS public.complejos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  logo_url TEXT,
  direccion_texto TEXT, -- Dirección en texto
  direccion_lat DECIMAL(10, 8), -- Latitud (coordenadas Google Maps)
  direccion_lng DECIMAL(11, 8), -- Longitud (coordenadas Google Maps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Constraint: debe tener dirección en texto O coordenadas, pero no ninguna
  CONSTRAINT complejo_direccion_check CHECK (
    (direccion_texto IS NOT NULL AND direccion_texto != '') OR
    (direccion_lat IS NOT NULL AND direccion_lng IS NOT NULL)
  )
);

-- Tabla de fotos de complejos
CREATE TABLE IF NOT EXISTS public.complejo_fotos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  complejo_id UUID REFERENCES public.complejos(id) ON DELETE CASCADE NOT NULL,
  foto_url TEXT NOT NULL,
  orden INTEGER DEFAULT 0, -- Orden de visualización
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_complejos_admin_id ON public.complejos(admin_id);
CREATE INDEX IF NOT EXISTS idx_complejo_fotos_complejo_id ON public.complejo_fotos(complejo_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.complejos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complejo_fotos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para complejos
-- Los administradores pueden ver sus propios complejos
CREATE POLICY "Admins can view own complejos"
  ON public.complejos
  FOR SELECT
  USING (auth.uid() = admin_id);

-- Los administradores pueden insertar sus propios complejos
CREATE POLICY "Admins can insert own complejos"
  ON public.complejos
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

-- Los administradores pueden actualizar sus propios complejos
CREATE POLICY "Admins can update own complejos"
  ON public.complejos
  FOR UPDATE
  USING (auth.uid() = admin_id);

-- Los administradores pueden eliminar sus propios complejos
CREATE POLICY "Admins can delete own complejos"
  ON public.complejos
  FOR DELETE
  USING (auth.uid() = admin_id);

-- Políticas RLS para fotos de complejos
-- Los administradores pueden ver fotos de sus complejos
CREATE POLICY "Admins can view own complejo fotos"
  ON public.complejo_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = complejo_fotos.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden insertar fotos de sus complejos
CREATE POLICY "Admins can insert own complejo fotos"
  ON public.complejo_fotos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = complejo_fotos.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden actualizar fotos de sus complejos
CREATE POLICY "Admins can update own complejo fotos"
  ON public.complejo_fotos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = complejo_fotos.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden eliminar fotos de sus complejos
CREATE POLICY "Admins can delete own complejo fotos"
  ON public.complejo_fotos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = complejo_fotos.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at en complejos
DROP TRIGGER IF EXISTS set_complejos_updated_at ON public.complejos;
CREATE TRIGGER set_complejos_updated_at
  BEFORE UPDATE ON public.complejos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE public.complejos IS 'Complejos deportivos gestionados por administradores';
COMMENT ON COLUMN public.complejos.direccion_texto IS 'Dirección en formato texto';
COMMENT ON COLUMN public.complejos.direccion_lat IS 'Latitud de la ubicación (Google Maps)';
COMMENT ON COLUMN public.complejos.direccion_lng IS 'Longitud de la ubicación (Google Maps)';
COMMENT ON TABLE public.complejo_fotos IS 'Fotos de los complejos deportivos';

