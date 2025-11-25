-- Agregar campo user_type a la tabla profiles
-- Ejecutar este script después de 01_setup_basico.sql

-- Agregar columna user_type si no existe
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('Jugador', 'Administrador de Cancha'));

-- Comentario para documentar el campo
COMMENT ON COLUMN public.profiles.user_type IS 'Tipo de usuario: Jugador o Administrador de Cancha';

