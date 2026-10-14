import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppUserRole,
  UpdateProfileData,
  UserProfile,
} from './types';

export async function hasUserType(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (error) return false;
  return !!profile?.user_type;
}

export async function getUserType(
  supabase: SupabaseClient
): Promise<AppUserRole | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return (profile?.user_type as AppUserRole | null) || null;
}

export async function getIsPlatformAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;

  const { data, error } = await supabase.rpc('es_admin_plataforma');
  if (error) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('es_admin_plataforma')
      .eq('id', user.id)
      .single();
    return Boolean(profile?.es_admin_plataforma);
  }
  return Boolean(data);
}

export async function getCurrentProfile(
  supabase: SupabaseClient
): Promise<UserProfile | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return profile as UserProfile;
}

export async function updateProfile(
  supabase: SupabaseClient,
  updates: UpdateProfileData
): Promise<UserProfile> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Usuario no autenticado');

  const updateData: Record<string, unknown> = {};
  if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
  if (updates.phone !== undefined) updateData.phone = updates.phone;

  if (updates.email !== undefined && updates.email !== user.email) {
    const { error: emailError } = await supabase.auth.updateUser({
      email: updates.email,
    });
    if (emailError) throw new Error(`Error al actualizar email: ${emailError.message}`);
    updateData.email = updates.email;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('No se pudo actualizar el perfil');
  return data as UserProfile;
}

/**
 * Asigna el rol de la app si el perfil aún no tiene user_type (usuarios normales).
 * Usuarios normales con otro rol reciben error (gate por app).
 * Superadmins (`es_admin_plataforma`) pueden entrar a cualquier app; se ajusta
 * `user_type` al rol de la app actual para que RLS y la UI funcionen al probar.
 */
export async function ensureAppRole(
  supabase: SupabaseClient,
  expectedRole: AppUserRole
): Promise<UserProfile> {
  const profile = await getCurrentProfile(supabase);
  if (!profile) throw new Error('Usuario no autenticado');

  const isPlatformAdmin = await getIsPlatformAdmin(supabase);

  if (isPlatformAdmin) {
    if (!profile.user_type || profile.user_type !== expectedRole) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ user_type: expectedRole })
        .eq('id', profile.id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error('No se pudo actualizar el rol');
      return data as UserProfile;
    }
    return profile;
  }

  if (!profile.user_type) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ user_type: expectedRole })
      .eq('id', profile.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('No se pudo asignar el tipo de usuario');
    return data as UserProfile;
  }

  if (profile.user_type !== expectedRole) {
    throw new Error(
      `Esta cuenta es de tipo "${profile.user_type}". Usa la app correspondiente.`
    );
  }

  return profile;
}
