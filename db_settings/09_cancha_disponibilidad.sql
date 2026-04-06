-- Tabla de disponibilidad de canchas
-- Ejecutar después de 07_canchas.sql

-- Tabla de disponibilidad de canchas
CREATE TABLE IF NOT EXISTS public.cancha_disponibilidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cancha_id UUID REFERENCES public.canchas(id) ON DELETE CASCADE NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=Lunes, 6=Domingo
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Constraint: hora_fin debe ser mayor que hora_inicio
  CONSTRAINT cancha_disponibilidad_horario_check CHECK (hora_fin > hora_inicio),
  -- Constraint: no puede haber duplicados de cancha_id y dia_semana
  CONSTRAINT cancha_disponibilidad_unique UNIQUE (cancha_id, dia_semana)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cancha_disponibilidad_cancha_id ON public.cancha_disponibilidad(cancha_id);
CREATE INDEX IF NOT EXISTS idx_cancha_disponibilidad_dia ON public.cancha_disponibilidad(dia_semana);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.cancha_disponibilidad ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para disponibilidad de canchas
-- Los administradores pueden ver disponibilidad de canchas de sus complejos
CREATE POLICY "Admins can view own cancha disponibilidad"
  ON public.cancha_disponibilidad
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_disponibilidad.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden insertar disponibilidad de canchas de sus complejos
CREATE POLICY "Admins can insert own cancha disponibilidad"
  ON public.cancha_disponibilidad
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_disponibilidad.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden actualizar disponibilidad de canchas de sus complejos
CREATE POLICY "Admins can update own cancha disponibilidad"
  ON public.cancha_disponibilidad
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_disponibilidad.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden eliminar disponibilidad de canchas de sus complejos
CREATE POLICY "Admins can delete own cancha disponibilidad"
  ON public.cancha_disponibilidad
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = cancha_disponibilidad.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE public.cancha_disponibilidad IS 'Horarios de disponibilidad de las canchas por día de la semana';
COMMENT ON COLUMN public.cancha_disponibilidad.dia_semana IS 'Día de la semana: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo';
COMMENT ON COLUMN public.cancha_disponibilidad.hora_inicio IS 'Hora de inicio de disponibilidad';
COMMENT ON COLUMN public.cancha_disponibilidad.hora_fin IS 'Hora de fin de disponibilidad';

