-- Configuración del bucket de Storage para equipos
-- Ejecutar este script en el SQL Editor de Supabase
--
-- NOTA: Los buckets de Storage se crean desde la interfaz web de Supabase, no desde SQL
-- Ve a: Storage > Create a new bucket
-- Nombre del bucket: equipos
-- Public bucket: Sí (para que los logos sean accesibles públicamente)
-- File size limit: 2MB (o el que prefieras)
-- Allowed MIME types: image/jpeg, image/png
--
-- IMPORTANTE: Este script debe ejecutarse desde el SQL Editor de Supabase
-- con permisos de administrador. Si recibes un error de permisos, verifica
-- que estás usando una cuenta con permisos suficientes o ejecuta cada política
-- individualmente desde la interfaz de Storage > Policies.
--
-- Si recibes un error "EXPLAIN only works on a single SQL statement", 
-- ejecuta cada bloque DROP + CREATE POLICY por separado (cada par de líneas).
--
-- Después de crear el bucket, ejecuta las siguientes políticas RLS:

-- Política: Permitir a los jugadores subir logos de sus equipos
DROP POLICY IF EXISTS "Players can upload equipo logos" ON storage.objects;
CREATE POLICY "Players can upload equipo logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'equipos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'Jugador'
  )
);

-- Política: Cualquiera puede ver los logos de equipos (público)
DROP POLICY IF EXISTS "Anyone can view equipo logos" ON storage.objects;
CREATE POLICY "Anyone can view equipo logos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'equipos'
);

-- Política: Permitir a los creadores actualizar logos de sus equipos
DROP POLICY IF EXISTS "Creators can update own equipo logos" ON storage.objects;
CREATE POLICY "Creators can update own equipo logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'equipos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.equipos
    WHERE equipos.creador_id = auth.uid()
    AND equipos.logo_url LIKE '%' || storage.objects.name
  )
);

-- Política: Permitir a los creadores eliminar logos de sus equipos
DROP POLICY IF EXISTS "Creators can delete own equipo logos" ON storage.objects;
CREATE POLICY "Creators can delete own equipo logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'equipos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.equipos
    WHERE equipos.creador_id = auth.uid()
    AND equipos.logo_url LIKE '%' || storage.objects.name
  )
);

-- Comentarios para documentación (opcional, pueden causar errores si se ejecutan junto con las políticas)
-- COMMENT ON POLICY "Players can upload equipo logos" ON storage.objects IS 
--   'Permite a los jugadores subir logos para sus equipos';
-- 
-- COMMENT ON POLICY "Anyone can view equipo logos" ON storage.objects IS 
--   'Los logos de equipos son públicos para que se puedan ver en la app';
