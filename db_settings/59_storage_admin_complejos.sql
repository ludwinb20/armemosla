-- Storage: superadmin puede subir/editar/eliminar imágenes de complejos
-- Ejecutar después de 58_admin_complejos_canchas.sql

DROP POLICY IF EXISTS "Admin plataforma upload complejo images" ON storage.objects;
CREATE POLICY "Admin plataforma upload complejo images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'complejos'
    AND public.es_admin_plataforma()
  );

DROP POLICY IF EXISTS "Admin plataforma update complejo images" ON storage.objects;
CREATE POLICY "Admin plataforma update complejo images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'complejos'
    AND public.es_admin_plataforma()
  );

DROP POLICY IF EXISTS "Admin plataforma delete complejo images" ON storage.objects;
CREATE POLICY "Admin plataforma delete complejo images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'complejos'
    AND public.es_admin_plataforma()
  );
