-- Configuración del bucket de Storage para canchas
-- Ejecutar este script en el SQL Editor de Supabase
--
-- NOTA: Los buckets de Storage se crean desde la interfaz web de Supabase, no desde SQL
-- Ve a: Storage > Create a new bucket
-- Nombre del bucket: canchas
-- Public bucket: Sí (para que las imágenes sean accesibles públicamente)
-- File size limit: 5MB (o el que prefieras)
-- Allowed MIME types: image/jpeg, image/png
--
-- Después de crear el bucket, ejecuta las siguientes políticas RLS:

-- Política: Permitir a los administradores subir imágenes de sus canchas
CREATE POLICY "Admins can upload cancha images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'canchas' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'Administrador de Cancha'
  )
);

-- Política: Permitir a los administradores ver imágenes de sus canchas
CREATE POLICY "Admins can view own cancha images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'canchas' AND
  (
    -- Cualquiera puede ver las imágenes (bucket público)
    true
    OR
    -- O si es el administrador que las subió
    (
      auth.role() = 'authenticated' AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'Administrador de Cancha'
      )
    )
  )
);

-- Política: Permitir a los administradores actualizar imágenes de sus canchas
CREATE POLICY "Admins can update own cancha images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'canchas' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'Administrador de Cancha'
  )
);

-- Política: Permitir a los administradores eliminar imágenes de sus canchas
CREATE POLICY "Admins can delete own cancha images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'canchas' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'Administrador de Cancha'
  )
);

-- NOTA IMPORTANTE:
-- Si quieres que las imágenes sean completamente públicas (sin autenticación),
-- puedes usar esta política más simple para SELECT:
-- 
-- CREATE POLICY "Public can view cancha images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'canchas');

