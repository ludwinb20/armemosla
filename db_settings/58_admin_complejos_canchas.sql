-- CRUD de complejos/canchas para superadmin (admin-web)
-- Ejecutar después de 57_dashboard_plataforma.sql

-- Dueños de cancha: lectura para selector en formularios
DROP POLICY IF EXISTS profiles_select_admins_cancha_admin_plataforma ON public.profiles;
CREATE POLICY profiles_select_admins_cancha_admin_plataforma
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.es_admin_plataforma()
    AND user_type = 'Administrador de Cancha'
  );

-- Complejos: escritura (SELECT ya existe en 56_prospectos_venues.sql)
DROP POLICY IF EXISTS complejos_admin_plataforma_write ON public.complejos;
CREATE POLICY complejos_admin_plataforma_write
  ON public.complejos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS complejos_admin_plataforma_update ON public.complejos;
CREATE POLICY complejos_admin_plataforma_update
  ON public.complejos
  FOR UPDATE
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS complejos_admin_plataforma_delete ON public.complejos;
CREATE POLICY complejos_admin_plataforma_delete
  ON public.complejos
  FOR DELETE
  TO authenticated
  USING (public.es_admin_plataforma());

-- Canchas
DROP POLICY IF EXISTS canchas_admin_plataforma_write ON public.canchas;
CREATE POLICY canchas_admin_plataforma_write
  ON public.canchas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS canchas_admin_plataforma_update ON public.canchas;
CREATE POLICY canchas_admin_plataforma_update
  ON public.canchas
  FOR UPDATE
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS canchas_admin_plataforma_delete ON public.canchas;
CREATE POLICY canchas_admin_plataforma_delete
  ON public.canchas
  FOR DELETE
  TO authenticated
  USING (public.es_admin_plataforma());

-- Fotos de complejos
DROP POLICY IF EXISTS complejo_fotos_admin_plataforma_all ON public.complejo_fotos;
CREATE POLICY complejo_fotos_admin_plataforma_all
  ON public.complejo_fotos
  FOR ALL
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

-- Fotos de canchas
DROP POLICY IF EXISTS cancha_fotos_admin_plataforma_all ON public.cancha_fotos;
CREATE POLICY cancha_fotos_admin_plataforma_all
  ON public.cancha_fotos
  FOR ALL
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

-- Disponibilidad de canchas
DROP POLICY IF EXISTS cancha_disponibilidad_admin_plataforma_all ON public.cancha_disponibilidad;
CREATE POLICY cancha_disponibilidad_admin_plataforma_all
  ON public.cancha_disponibilidad
  FOR ALL
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());
