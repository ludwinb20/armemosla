-- Actualizar constraint de dirección en complejos
-- Las coordenadas son obligatorias, el texto es opcional
-- Ejecutar después de 03_complejos_deportivos.sql

-- PASO 1: Eliminar el constraint anterior
ALTER TABLE public.complejos
DROP CONSTRAINT IF EXISTS complejo_direccion_check;

-- PASO 2: Verificar y manejar filas existentes sin coordenadas
-- IMPORTANTE: Elige una de las dos opciones siguientes:

-- OPCIÓN A: Eliminar complejos sin coordenadas (recomendado si son datos de prueba)
DELETE FROM public.complejos WHERE direccion_lat IS NULL OR direccion_lng IS NULL;

-- OPCIÓN B: Asignar coordenadas por defecto (Santiago, Chile) a complejos sin coordenadas
-- Descomenta las siguientes líneas si prefieres mantener los complejos con coordenadas por defecto:
-- UPDATE public.complejos
-- SET 
--   direccion_lat = -33.4489,
--   direccion_lng = -70.6693
-- WHERE direccion_lat IS NULL OR direccion_lng IS NULL;

-- PASO 3: Agregar nuevo constraint: las coordenadas son obligatorias
ALTER TABLE public.complejos
ADD CONSTRAINT complejo_direccion_check CHECK (
  direccion_lat IS NOT NULL AND direccion_lng IS NOT NULL
);

-- PASO 4: Actualizar comentarios
COMMENT ON COLUMN public.complejos.direccion_texto IS 'Dirección en formato texto (opcional)';
COMMENT ON COLUMN public.complejos.direccion_lat IS 'Latitud de la ubicación (Google Maps) - OBLIGATORIA';
COMMENT ON COLUMN public.complejos.direccion_lng IS 'Longitud de la ubicación (Google Maps) - OBLIGATORIA';

