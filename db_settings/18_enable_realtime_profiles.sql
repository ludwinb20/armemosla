-- Habilitar Realtime para la tabla profiles
-- Ejecutar este script en el SQL Editor de Supabase
-- 
-- NOTA: Realtime permite suscripciones en tiempo real a cambios en la base de datos
-- Esto es necesario para que las suscripciones de postgres_changes funcionen

-- Habilitar publicación Realtime para la tabla profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Verificar que está habilitado
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'profiles';

-- Comentario para documentación
COMMENT ON TABLE public.profiles IS 
  'Tabla de perfiles de usuario - Realtime habilitado para suscripciones en tiempo real';
