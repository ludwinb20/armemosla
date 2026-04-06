import { supabase } from './supabase';

export interface Complejo {
  id: string;
  admin_id: string;
  nombre: string;
  logo_url?: string;
  direccion_texto?: string;
  direccion_lat?: number;
  direccion_lng?: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComplejoFoto {
  id: string;
  complejo_id: string;
  foto_url: string;
  orden: number;
  created_at: string;
}

export interface ComplejoWithFotos extends Complejo {
  fotos?: ComplejoFoto[];
}

/**
 * Obtiene todos los complejos del administrador actual
 */
export async function getComplejos(): Promise<ComplejoWithFotos[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: complejos, error } = await supabase
      .from('complejos')
      .select('*')
      .eq('admin_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Obtener fotos para cada complejo
    const complejosWithFotos = await Promise.all(
      (complejos || []).map(async (complejo) => {
        const { data: fotos } = await supabase
          .from('complejo_fotos')
          .select('*')
          .eq('complejo_id', complejo.id)
          .order('orden', { ascending: true });

        return {
          ...complejo,
          fotos: fotos || [],
        };
      })
    );

    return complejosWithFotos;
  } catch (error: any) {
    console.error('❌ [getComplejos] Error:', error);
    throw error;
  }
}

/**
 * Obtiene un complejo por ID
 */
export async function getComplejoById(id: string): Promise<ComplejoWithFotos | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: complejo, error } = await supabase
      .from('complejos')
      .select('*')
      .eq('id', id)
      .eq('admin_id', user.id)
      .single();

    if (error) throw error;
    if (!complejo) return null;

    // Obtener fotos
    const { data: fotos } = await supabase
      .from('complejo_fotos')
      .select('*')
      .eq('complejo_id', id)
      .order('orden', { ascending: true });

    return {
      ...complejo,
      fotos: fotos || [],
    };
  } catch (error: any) {
    console.error('❌ [getComplejoById] Error:', error);
    throw error;
  }
}

/**
 * Crea un nuevo complejo
 */
export async function createComplejo(
  complejo: Omit<Complejo, 'id' | 'admin_id' | 'created_at' | 'updated_at' | 'activo'>
): Promise<Complejo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('complejos')
      .insert({
        ...complejo,
        admin_id: user.id,
        activo: true, // Los nuevos complejos se crean activos por defecto
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [createComplejo] Error:', error);
    throw error;
  }
}

/**
 * Actualiza un complejo
 */
export async function updateComplejo(
  id: string,
  updates: Partial<Omit<Complejo, 'id' | 'admin_id' | 'created_at' | 'updated_at'>>
): Promise<Complejo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('complejos')
      .update(updates)
      .eq('id', id)
      .eq('admin_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [updateComplejo] Error:', error);
    throw error;
  }
}

/**
 * Desactiva o activa un complejo
 */
export async function toggleComplejoActivo(id: string, activo: boolean): Promise<Complejo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('complejos')
      .update({ activo })
      .eq('id', id)
      .eq('admin_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [toggleComplejoActivo] Error:', error);
    throw error;
  }
}

/**
 * Agrega una foto a un complejo
 */
export async function addComplejoFoto(
  complejoId: string,
  fotoUrl: string,
  orden: number = 0
): Promise<ComplejoFoto> {
  try {
    const { data, error } = await supabase
      .from('complejo_fotos')
      .insert({
        complejo_id: complejoId,
        foto_url: fotoUrl,
        orden,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [addComplejoFoto] Error:', error);
    throw error;
  }
}

/**
 * Elimina una foto de un complejo
 */
export async function deleteComplejoFoto(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('complejo_fotos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [deleteComplejoFoto] Error:', error);
    throw error;
  }
}

/**
 * Obtiene todos los complejos públicos activos (para jugadores)
 * Sin filtrar por administrador
 */
export async function getComplejosPublicos(): Promise<ComplejoWithFotos[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: complejos, error } = await supabase
      .from('complejos')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Obtener fotos para cada complejo
    const complejosWithFotos = await Promise.all(
      (complejos || []).map(async (complejo) => {
        const { data: fotos } = await supabase
          .from('complejo_fotos')
          .select('*')
          .eq('complejo_id', complejo.id)
          .order('orden', { ascending: true });

        return {
          ...complejo,
          fotos: fotos || [],
        };
      })
    );

    return complejosWithFotos;
  } catch (error: any) {
    console.error('❌ [getComplejosPublicos] Error:', error);
    throw error;
  }
}
