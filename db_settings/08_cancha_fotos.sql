-- Tabla de fotos de canchas
-- Ejecutar después de 07_canchas.sql

-- Tabla de fotos de canchas
CREATE TABLE IF NOT EXISTS public.cancha_fotos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cancha_id UUID REFERENCES public.canchas(id) ON DELETE CASCADE NOT NULL,
  foto_url TEXT NOT NULL,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cancha_fotos_cancha_id ON public.cancha_fotos(cancha_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.cancha_fotos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fotos de canchas
-- Los administradores pueden ver fotos de canchas de sus complejos
CREATE POLICY "Admins can view own cancha fotos"
  ON public.cancha_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_fotos.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden insertar fotos de canchas de sus complejos
CREATE POLICY "Admins can insert own cancha fotos"
  ON public.cancha_fotos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_fotos.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden actualizar fotos de canchas de sus complejos
CREATE POLICY "Admins can update own cancha fotos"
  ON public.cancha_fotos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_fotos.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden eliminar fotos de canchas de sus complejos
CREATE POLICY "Admins can delete own cancha fotos"
  ON public.cancha_fotos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_fotos.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE public.cancha_fotos IS 'Fotos de las canchas deportivas';

