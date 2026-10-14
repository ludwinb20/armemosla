-- Storage: superadmin puede subir/editar/eliminar imágenes de canchas
-- Ejecutar después de 59_storage_admin_complejos.sql

DROP POLICY IF EXISTS "Admin plataforma upload cancha images" ON storage.objects;
CREATE POLICY "Admin plataforma upload cancha images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'canchas'
    AND public.es_admin_plataforma()
  );

DROP POLICY IF EXISTS "Admin plataforma update cancha images" ON storage.objects;
CREATE POLICY "Admin plataforma update cancha images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'canchas'
    AND public.es_admin_plataforma()
  );

DROP POLICY IF EXISTS "Admin plataforma delete cancha images" ON storage.objects;
CREATE POLICY "Admin plataforma delete cancha images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'canchas'
    AND public.es_admin_plataforma()
  );
