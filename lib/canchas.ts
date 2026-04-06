import { supabase } from './supabase';

export interface Cancha {
  id: string;
  complejo_id: string;
  nombre: string;
  largo?: number;
  ancho?: number;
  jugadores_por_equipo: number;
  precio_por_hora: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CanchaFoto {
  id: string;
  cancha_id: string;
  foto_url: string;
  orden: number;
  created_at: string;
}

export interface CanchaDisponibilidad {
  id: string;
  cancha_id: string;
  dia_semana: number; // 0=Lunes, 6=Domingo
  hora_inicio: string; // TIME format
  hora_fin: string; // TIME format
  created_at: string;
}

export interface CanchaWithRelations extends Cancha {
  fotos?: CanchaFoto[];
  disponibilidad?: CanchaDisponibilidad[];
  complejo?: {
    id: string;
    nombre: string;
  };
}

/**
 * Obtiene todas las canchas del administrador actual
 * @param complejoId - Opcional: filtrar por complejo específico
 * @param activo - Opcional: filtrar por estado activo/inactivo
 */
export async function getCanchas(
  complejoId?: string,
  activo?: boolean
): Promise<CanchaWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Primero obtener los IDs de los complejos del admin
    const { data: complejosAdmin } = await supabase
      .from('complejos')
      .select('id')
      .eq('admin_id', user.id);

    if (!complejosAdmin || complejosAdmin.length === 0) {
      return [];
    }

    const complejoIds = complejosAdmin.map(c => c.id);

    let query = supabase
      .from('canchas')
      .select(`
        *,
        complejo:complejos!canchas_complejo_id_fkey (
          id,
          nombre
        )
      `)
      .in('complejo_id', complejoIds);

    // Filtrar por complejo si se especifica
    if (complejoId) {
      query = query.eq('complejo_id', complejoId);
    }

    // Filtrar por estado activo si se especifica
    if (activo !== undefined) {
      query = query.eq('activo', activo);
    } else {
      // Por defecto, solo mostrar activas
      query = query.eq('activo', true);
    }

    const { data: canchas, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Obtener fotos y disponibilidad para cada cancha
    const canchasWithRelations = await Promise.all(
      (canchas || []).map(async (cancha) => {
        const [fotosResult, disponibilidadResult] = await Promise.all([
          supabase
            .from('cancha_fotos')
            .select('*')
            .eq('cancha_id', cancha.id)
            .order('orden', { ascending: true }),
          supabase
            .from('cancha_disponibilidad')
            .select('*')
            .eq('cancha_id', cancha.id)
            .order('dia_semana', { ascending: true }),
        ]);

        return {
          ...cancha,
          fotos: fotosResult.data || [],
          disponibilidad: disponibilidadResult.data || [],
        };
      })
    );

    return canchasWithRelations;
  } catch (error: any) {
    console.error('❌ [getCanchas] Error:', error);
    throw error;
  }
}

/**
 * Obtiene una cancha por ID
 */
export async function getCanchaById(id: string): Promise<CanchaWithRelations | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: cancha, error } = await supabase
      .from('canchas')
      .select(`
        *,
        complejo:complejos!canchas_complejo_id_fkey (
          id,
          nombre
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!cancha) return null;

    // Verificar que el complejo pertenece al admin
    const { data: complejo } = await supabase
      .from('complejos')
      .select('admin_id')
      .eq('id', cancha.complejo_id)
      .single();

    if (!complejo || complejo.admin_id !== user.id) {
      throw new Error('No tienes permiso para ver esta cancha');
    }

    // Obtener fotos y disponibilidad
    const [fotosResult, disponibilidadResult] = await Promise.all([
      supabase
        .from('cancha_fotos')
        .select('*')
        .eq('cancha_id', id)
        .order('orden', { ascending: true }),
      supabase
        .from('cancha_disponibilidad')
        .select('*')
        .eq('cancha_id', id)
        .order('dia_semana', { ascending: true }),
    ]);

    return {
      ...cancha,
      fotos: fotosResult.data || [],
      disponibilidad: disponibilidadResult.data || [],
    };
  } catch (error: any) {
    console.error('❌ [getCanchaById] Error:', error);
    throw error;
  }
}

/**
 * Crea una nueva cancha
 */
export async function createCancha(
  cancha: Omit<Cancha, 'id' | 'created_at' | 'updated_at' | 'activo'>
): Promise<Cancha> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que el complejo pertenece al admin
    const { data: complejo } = await supabase
      .from('complejos')
      .select('admin_id')
      .eq('id', cancha.complejo_id)
      .single();

    if (!complejo || complejo.admin_id !== user.id) {
      throw new Error('No tienes permiso para crear canchas en este complejo');
    }

    const { data, error } = await supabase
      .from('canchas')
      .insert({
        ...cancha,
        activo: true, // Las nuevas canchas se crean activas por defecto
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [createCancha] Error:', error);
    throw error;
  }
}

/**
 * Actualiza una cancha
 */
export async function updateCancha(
  id: string,
  updates: Partial<Omit<Cancha, 'id' | 'created_at' | 'updated_at'>>
): Promise<Cancha> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que la cancha pertenece a un complejo del admin
    const { data: cancha } = await supabase
      .from('canchas')
      .select('complejo_id, complejos!inner(admin_id)')
      .eq('id', id)
      .single();

    if (!cancha || (cancha.complejos as any).admin_id !== user.id) {
      throw new Error('No tienes permiso para actualizar esta cancha');
    }

    // Si se está actualizando el complejo_id, verificar que el nuevo complejo pertenezca al admin
    if (updates.complejo_id && updates.complejo_id !== cancha.complejo_id) {
      const { data: nuevoComplejo } = await supabase
        .from('complejos')
        .select('admin_id')
        .eq('id', updates.complejo_id)
        .single();

      if (!nuevoComplejo || nuevoComplejo.admin_id !== user.id) {
        throw new Error('No tienes permiso para mover esta cancha a ese complejo');
      }
    }

    const { data, error } = await supabase
      .from('canchas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [updateCancha] Error:', error);
    throw error;
  }
}

/**
 * Activa o desactiva una cancha
 */
export async function toggleCanchaActivo(id: string, activo: boolean): Promise<Cancha> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que la cancha pertenece a un complejo del admin
    const { data: cancha } = await supabase
      .from('canchas')
      .select('complejo_id, complejos!inner(admin_id)')
      .eq('id', id)
      .single();

    if (!cancha || (cancha.complejos as any).admin_id !== user.id) {
      throw new Error('No tienes permiso para modificar esta cancha');
    }

    const { data, error } = await supabase
      .from('canchas')
      .update({ activo })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [toggleCanchaActivo] Error:', error);
    throw error;
  }
}

/**
 * Obtiene todas las canchas públicas activas (para jugadores)
 * Sin filtrar por administrador
 */
export async function getCanchasPublicas(): Promise<CanchaWithRelations[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: canchas, error } = await supabase
      .from('canchas')
      .select(`
        *,
        complejo:complejos!inner(
          id,
          nombre,
          direccion_texto,
          direccion_lat,
          direccion_lng
        )
      `)
      .eq('activo', true)
      .eq('complejos.activo', true)
      .order('precio_por_hora', { ascending: true });

    if (error) throw error;

    // Obtener fotos para cada cancha
    const canchasWithRelations = await Promise.all(
      (canchas || []).map(async (cancha) => {
        const { data: fotos } = await supabase
          .from('cancha_fotos')
          .select('*')
          .eq('cancha_id', cancha.id)
          .order('orden', { ascending: true });

        return {
          ...cancha,
          fotos: fotos || [],
        };
      })
    );

    return canchasWithRelations;
  } catch (error: any) {
    console.error('❌ [getCanchasPublicas] Error:', error);
    throw error;
  }
}

/**
 * Agrega una foto a una cancha
 */
export async function addCanchaFoto(
  canchaId: string,
  fotoUrl: string,
  orden: number = 0
): Promise<CanchaFoto> {
  try {
    const { data, error } = await supabase
      .from('cancha_fotos')
      .insert({
        cancha_id: canchaId,
        foto_url: fotoUrl,
        orden,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [addCanchaFoto] Error:', error);
    throw error;
  }
}

/**
 * Elimina una foto de una cancha
 */
export async function deleteCanchaFoto(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('cancha_fotos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [deleteCanchaFoto] Error:', error);
    throw error;
  }
}

/**
 * Establece la disponibilidad de una cancha
 * Reemplaza toda la disponibilidad existente
 */
export async function setCanchaDisponibilidad(
  canchaId: string,
  disponibilidad: Array<{ dia_semana: number; hora_inicio: string; hora_fin: string }>
): Promise<void> {
  try {
    // Eliminar disponibilidad existente
    await supabase
      .from('cancha_disponibilidad')
      .delete()
      .eq('cancha_id', canchaId);

    // Insertar nueva disponibilidad
    if (disponibilidad.length > 0) {
      const { error } = await supabase
        .from('cancha_disponibilidad')
        .insert(
          disponibilidad.map((d) => ({
            cancha_id: canchaId,
            dia_semana: d.dia_semana,
            hora_inicio: d.hora_inicio,
            hora_fin: d.hora_fin,
          }))
        );

      if (error) throw error;
    }
  } catch (error: any) {
    console.error('❌ [setCanchaDisponibilidad] Error:', error);
    throw error;
  }
}

/**
 * Obtiene la disponibilidad de una cancha
 */
export async function getCanchaDisponibilidad(
  canchaId: string
): Promise<CanchaDisponibilidad[]> {
  try {
    const { data, error } = await supabase
      .from('cancha_disponibilidad')
      .select('*')
      .eq('cancha_id', canchaId)
      .order('dia_semana', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('❌ [getCanchaDisponibilidad] Error:', error);
    throw error;
  }
}

