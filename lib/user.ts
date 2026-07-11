import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  user_type: 'Jugador' | 'Administrador de Cancha' | null;
  es_admin_plataforma?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  email?: string;
}

/**
 * Verifica si el usuario actual tiene configurado su tipo de usuario
 * @returns true si tiene user_type configurado, false si no
 */
export async function hasUserType(): Promise<boolean> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [hasUserType] Error al obtener usuario:', userError);
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [hasUserType] Error al obtener perfil:', profileError);
      return false;
    }

    return !!profile?.user_type;
  } catch (error) {
    console.error('❌ [hasUserType] Error general:', error);
    return false;
  }
}

/**
 * Obtiene el tipo de usuario actual
 * @returns 'Jugador' | 'Administrador de Cancha' | null
 */
export async function getUserType(): Promise<'Jugador' | 'Administrador de Cancha' | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [getUserType] Error al obtener usuario:', userError);
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [getUserType] Error al obtener perfil:', profileError);
      return null;
    }

    return profile?.user_type || null;
  } catch (error) {
    console.error('❌ [getUserType] Error general:', error);
    return null;
  }
}

/**
 * Indica si el usuario es operador Armemosla (admin plataforma).
 */
export async function getIsPlatformAdmin(): Promise<boolean> {
  try {
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
  } catch {
    return false;
  }
}

/**
 * Ruta inicial tras login o al abrir la app.
 */
export async function getInitialAppRoute(): Promise<string> {
  if (await getIsPlatformAdmin()) {
    return '/(tabs)/revision-pagos';
  }

  const userType = await getUserType();
  if (userType === 'Jugador') {
    return '/(tabs)/armemosla';
  }
  if (userType === 'Administrador de Cancha') {
    return '/(tabs)/home';
  }

  return '/select-user-type';
}

/**
 * Obtiene el perfil completo del usuario actual
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [getCurrentProfile] Error al obtener usuario:', userError);
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [getCurrentProfile] Error al obtener perfil:', profileError);
      return null;
    }

    return profile as UserProfile;
  } catch (error) {
    console.error('❌ [getCurrentProfile] Error general:', error);
    return null;
  }
}

/**
 * Actualiza el perfil del usuario actual
 */
export async function updateProfile(updates: UpdateProfileData): Promise<UserProfile> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Usuario no autenticado');
    }

    const updateData: any = {};
    if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
    if (updates.phone !== undefined) updateData.phone = updates.phone;

    // Si se actualiza el email, también actualizarlo en auth.users
    if (updates.email !== undefined && updates.email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: updates.email,
      });

      if (emailError) {
        throw new Error(`Error al actualizar email: ${emailError.message}`);
      }

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
  } catch (error: any) {
    console.error('❌ [updateProfile] Error:', error);
    throw error;
  }
}

/**
 * Cambia el tipo de usuario del usuario actual
 * @param newUserType Nuevo tipo de usuario
 */
export async function changeUserType(newUserType: 'Jugador' | 'Administrador de Cancha'): Promise<UserProfile> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ user_type: newUserType })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo cambiar el tipo de usuario');

    return data as UserProfile;
  } catch (error: any) {
    console.error('❌ [changeUserType] Error:', error);
    throw error;
  }
}
