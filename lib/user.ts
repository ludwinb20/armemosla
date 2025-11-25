import { supabase } from './supabase';

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

