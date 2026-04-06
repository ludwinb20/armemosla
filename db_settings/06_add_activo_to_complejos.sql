-- Agregar campo activo a la tabla complejos
-- Ejecutar después de 03_complejos_deportivos.sql

-- Agregar columna activo (por defecto true para complejos existentes)
ALTER TABLE public.complejos
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true NOT NULL;

-- Actualizar comentario
COMMENT ON COLUMN public.complejos.activo IS 'Indica si el complejo está activo y visible para los usuarios';

-- Crear índice para mejorar consultas de complejos activos
CREATE INDEX IF NOT EXISTS idx_complejos_activo ON public.complejos(activo);

