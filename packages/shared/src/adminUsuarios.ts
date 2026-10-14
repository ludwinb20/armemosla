import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUserRole, UserProfile } from './types';

export const USER_TYPE_LABELS: Record<AppUserRole, string> = {
  Jugador: 'Jugador',
  'Administrador de Cancha': 'Dueño de cancha',
};

export interface UpdateUsuarioAdminInput {
  full_name?: string | null;
  phone?: string | null;
  user_type?: AppUserRole | null;
  es_admin_plataforma?: boolean;
}

export interface CreateUsuarioAdminInput {
  email: string;
  password: string;
  full_name?: string | null;
  phone?: string | null;
  user_type: AppUserRole;
  es_admin_plataforma?: boolean;
}

export async function listarUsuariosAdmin(
  supabase: SupabaseClient,
  userType?: AppUserRole | 'sin_tipo'
): Promise<UserProfile[]> {
  let query = supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (userType === 'sin_tipo') {
    query = query.is('user_type', null);
  } else if (userType) {
    query = query.eq('user_type', userType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as UserProfile[];
}

export async function getUsuarioAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as UserProfile | null;
}

export async function actualizarUsuarioAdmin(
  supabase: SupabaseClient,
  id: string,
  input: UpdateUsuarioAdminInput
): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('actualizar_usuario_plataforma', {
    p_user_id: id,
    p_full_name: input.full_name ?? null,
    p_phone: input.phone ?? null,
    p_user_type: input.user_type ?? null,
    p_es_admin_plataforma: input.es_admin_plataforma ?? null,
  });

  if (error) throw error;
  return data as UserProfile;
}
