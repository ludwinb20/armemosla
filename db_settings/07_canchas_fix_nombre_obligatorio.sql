-- Script de migración para hacer el nombre de canchas obligatorio
-- Ejecutar si ya se ejecutó 07_canchas.sql con nombre opcional
-- Este script actualiza la columna nombre para que sea NOT NULL

-- PASO 1: Asignar nombres por defecto a canchas sin nombre (si existen)
-- Usaremos un nombre basado en el ID de la cancha
UPDATE public.canchas
SET nombre = 'Cancha ' || SUBSTRING(id::text, 1, 8)
WHERE nombre IS NULL OR nombre = '';

-- PASO 2: Agregar constraint NOT NULL a la columna nombre
ALTER TABLE public.canchas
ALTER COLUMN nombre SET NOT NULL;

-- Verificar que la migración fue exitosa
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'canchas' AND column_name = 'nombre';

