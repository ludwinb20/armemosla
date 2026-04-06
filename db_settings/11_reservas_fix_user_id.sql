-- Script de migración para corregir la foreign key de user_id en reservas
-- Ejecutar si ya se ejecutó 11_reservas.sql con la foreign key incorrecta
-- Este script actualiza la foreign key de auth.users a profiles

-- PASO 1: Eliminar la foreign key existente (si existe)
ALTER TABLE public.reservas
DROP CONSTRAINT IF EXISTS reservas_user_id_fkey;

-- PASO 2: Agregar la nueva foreign key que apunta a profiles
ALTER TABLE public.reservas
ADD CONSTRAINT reservas_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Verificar que la migración fue exitosa
-- SELECT 
--   tc.constraint_name, 
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'reservas' AND tc.constraint_type = 'FOREIGN KEY';

