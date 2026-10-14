-- CRUD de reservas para superadmin (admin-web)
-- Ejecutar después de 61_admin_usuarios.sql

DROP POLICY IF EXISTS reservas_admin_plataforma_select ON public.reservas;
CREATE POLICY reservas_admin_plataforma_select
  ON public.reservas
  FOR SELECT
  TO authenticated
  USING (public.es_admin_plataforma());

DROP POLICY IF EXISTS reservas_admin_plataforma_insert ON public.reservas;
CREATE POLICY reservas_admin_plataforma_insert
  ON public.reservas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS reservas_admin_plataforma_update ON public.reservas;
CREATE POLICY reservas_admin_plataforma_update
  ON public.reservas
  FOR UPDATE
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS reservas_admin_plataforma_delete ON public.reservas;
CREATE POLICY reservas_admin_plataforma_delete
  ON public.reservas
  FOR DELETE
  TO authenticated
  USING (public.es_admin_plataforma());
