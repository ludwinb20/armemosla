-- Tabla de canchas deportivas
-- Ejecutar después de 03_complejos_deportivos.sql

-- Tabla de canchas
CREATE TABLE IF NOT EXISTS public.canchas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  complejo_id UUID REFERENCES public.complejos(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  largo DECIMAL(10, 2), -- Largo en metros
  ancho DECIMAL(10, 2), -- Ancho en metros
  jugadores_por_equipo INTEGER NOT NULL CHECK (jugadores_por_equipo > 0),
  precio_por_hora DECIMAL(10, 2) NOT NULL CHECK (precio_por_hora >= 0),
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_canchas_complejo_id ON public.canchas(complejo_id);
CREATE INDEX IF NOT EXISTS idx_canchas_activo ON public.canchas(activo);
CREATE INDEX IF NOT EXISTS idx_canchas_complejo_activo ON public.canchas(complejo_id, activo);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.canchas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para canchas
-- Los administradores pueden ver canchas de sus complejos
CREATE POLICY "Admins can view own canchas"
  ON public.canchas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = canchas.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden insertar canchas en sus complejos
CREATE POLICY "Admins can insert own canchas"
  ON public.canchas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = canchas.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden actualizar canchas de sus complejos
CREATE POLICY "Admins can update own canchas"
  ON public.canchas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = canchas.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden eliminar canchas de sus complejos
CREATE POLICY "Admins can delete own canchas"
  ON public.canchas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      WHERE complejos.id = canchas.complejo_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at en canchas
DROP TRIGGER IF EXISTS set_canchas_updated_at ON public.canchas;
CREATE TRIGGER set_canchas_updated_at
  BEFORE UPDATE ON public.canchas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE public.canchas IS 'Canchas deportivas pertenecientes a complejos';
COMMENT ON COLUMN public.canchas.nombre IS 'Nombre de la cancha (opcional)';
COMMENT ON COLUMN public.canchas.largo IS 'Largo de la cancha en metros (opcional)';
COMMENT ON COLUMN public.canchas.ancho IS 'Ancho de la cancha en metros (opcional)';
COMMENT ON COLUMN public.canchas.jugadores_por_equipo IS 'Cantidad ideal/recomendada de jugadores por equipo (incluyendo portero)';
COMMENT ON COLUMN public.canchas.precio_por_hora IS 'Precio por hora de alquiler de la cancha';
COMMENT ON COLUMN public.canchas.activo IS 'Indica si la cancha está activa y disponible para reservas';

