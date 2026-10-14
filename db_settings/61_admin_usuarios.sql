-- CRUD de usuarios para superadmin (admin-web)
-- Ejecutar después de 60_storage_admin_canchas.sql

-- Reemplaza la política acotada a admins de cancha
DROP POLICY IF EXISTS profiles_select_admins_cancha_admin_plataforma ON public.profiles;

DROP POLICY IF EXISTS profiles_admin_plataforma_select ON public.profiles;
CREATE POLICY profiles_admin_plataforma_select
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.es_admin_plataforma());

DROP POLICY IF EXISTS profiles_admin_plataforma_update ON public.profiles;
CREATE POLICY profiles_admin_plataforma_update
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

CREATE OR REPLACE FUNCTION public.actualizar_usuario_plataforma(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_user_type TEXT DEFAULT NULL,
  p_es_admin_plataforma BOOLEAN DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_user_type IS NOT NULL
     AND p_user_type NOT IN ('Jugador', 'Administrador de Cancha') THEN
    RAISE EXCEPTION 'Tipo de usuario inválido';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    phone = CASE
      WHEN p_phone IS NULL THEN phone
      ELSE NULLIF(trim(p_phone), '')
    END,
    user_type = COALESCE(p_user_type, user_type),
    es_admin_plataforma = COALESCE(p_es_admin_plataforma, es_admin_plataforma)
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_usuario_plataforma(UUID, TEXT, TEXT, TEXT, BOOLEAN)
  TO authenticated;

COMMENT ON FUNCTION public.actualizar_usuario_plataforma IS
  'Actualiza perfil de usuario. Requiere es_admin_plataforma().';
