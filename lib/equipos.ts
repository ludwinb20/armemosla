import { supabase } from './supabase';

export interface Equipo {
  id: string;
  nombre: string;
  logo_url?: string;
  creador_id?: string;
  created_at: string;
  updated_at: string;
}

export interface JugadorEquipo {
  id: string;
  jugador_id: string;
  equipo_id: string;
  es_principal: boolean;
  rol?: string;
  created_at: string;
}

export interface EquipoWithMembers extends Equipo {
  miembros?: JugadorEquipo[];
  es_mi_equipo?: boolean;
  es_principal?: boolean;
}

/**
 * Crea un nuevo equipo
 */
export async function crearEquipo(
  nombre: string,
  logoUrl?: string
): Promise<Equipo> {
  try {
    const nombreLimpio = (nombre || '').trim();
    if (!nombreLimpio) {
      throw new Error('El nombre del equipo es obligatorio');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Regla de negocio: un solo equipo por jugador.
    const { data: existente, error: existingError } = await supabase
      .from('jugador_equipos')
      .select('equipo_id')
      .eq('jugador_id', user.id)
      .limit(1);
    if (existingError) throw existingError;
    if (existente && existente.length > 0) {
      throw new Error('Solo puedes tener un equipo. Edita el actual para cambiar nombre o escudo.');
    }

    const { data, error } = await supabase
      .from('equipos')
      .insert({
        nombre: nombreLimpio,
        logo_url: logoUrl,
        creador_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo crear el equipo');

    // Agregar al creador como miembro
    await agregarJugadorAEquipo(data.id, user.id, 'capitan', true);

    return data as Equipo;
  } catch (error: any) {
    console.error('❌ [crearEquipo] Error:', error);
    throw error;
  }
}

/**
 * Obtiene todos los equipos del jugador actual
 */
export async function obtenerEquiposJugador(): Promise<EquipoWithMembers[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: jugadorEquipos, error } = await supabase
      .from('jugador_equipos')
      .select(`
        id,
        es_principal,
        rol,
        equipo:equipos(*)
      `)
      .eq('jugador_id', user.id)
      .order('es_principal', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (jugadorEquipos || []).map((je: any) => ({
      ...je.equipo,
      es_principal: je.es_principal,
      es_mi_equipo: true,
    })) as EquipoWithMembers[];
  } catch (error: any) {
    console.error('❌ [obtenerEquiposJugador] Error:', error);
    throw error;
  }
}

/**
 * Obtiene un equipo por ID
 */
export async function obtenerEquipoById(id: string): Promise<EquipoWithMembers | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: equipo, error } = await supabase
      .from('equipos')
      .select(`
        *,
        miembros:jugador_equipos(
          id,
          jugador_id,
          es_principal,
          rol,
          jugador:profiles(id, full_name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!equipo) return null;

    // Verificar si el usuario actual es miembro
    const esMiembro = equipo.miembros?.some(
      (m: any) => m.jugador_id === user.id
    );

    const esPrincipal = equipo.miembros?.find(
      (m: any) => m.jugador_id === user.id && m.es_principal
    ) !== undefined;

    return {
      ...equipo,
      es_mi_equipo: esMiembro,
      es_principal: esPrincipal,
    } as EquipoWithMembers;
  } catch (error: any) {
    console.error('❌ [obtenerEquipoById] Error:', error);
    throw error;
  }
}

/**
 * Actualiza un equipo
 */
export async function actualizarEquipo(
  id: string,
  updates: { nombre?: string; logo_url?: string }
): Promise<Equipo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const updateData: any = {};
    if (updates.nombre !== undefined) {
      const nombreLimpio = updates.nombre.trim();
      if (!nombreLimpio) {
        throw new Error('El nombre del equipo es obligatorio');
      }
      updateData.nombre = nombreLimpio;
    }
    if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;

    const { data, error } = await supabase
      .from('equipos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar el equipo');

    return data as Equipo;
  } catch (error: any) {
    console.error('❌ [actualizarEquipo] Error:', error);
    throw error;
  }
}

/**
 * Elimina un equipo
 */
export async function eliminarEquipo(id: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('equipos')
      .delete()
      .eq('id', id)
      .eq('creador_id', user.id); // Solo el creador puede eliminar

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [eliminarEquipo] Error:', error);
    throw error;
  }
}

/**
 * Agrega un jugador a un equipo
 */
export async function agregarJugadorAEquipo(
  equipoId: string,
  jugadorId: string,
  rol: string = 'jugador',
  esPrincipal: boolean = false
): Promise<JugadorEquipo> {
  try {
    const { data, error } = await supabase
      .from('jugador_equipos')
      .insert({
        equipo_id: equipoId,
        jugador_id: jugadorId,
        rol,
        es_principal: esPrincipal,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo agregar el jugador al equipo');

    return data as JugadorEquipo;
  } catch (error: any) {
    console.error('❌ [agregarJugadorAEquipo] Error:', error);
    throw error;
  }
}

/**
 * Remueve un jugador de un equipo
 */
export async function removerJugadorDeEquipo(
  equipoId: string,
  jugadorId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('jugador_equipos')
      .delete()
      .eq('equipo_id', equipoId)
      .eq('jugador_id', jugadorId);

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [removerJugadorDeEquipo] Error:', error);
    throw error;
  }
}

/**
 * Establece un equipo como principal del jugador
 */
export async function establecerEquipoPrincipal(equipoId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Primero, quitar principal de todos los equipos del jugador
    await supabase
      .from('jugador_equipos')
      .update({ es_principal: false })
      .eq('jugador_id', user.id);

    // Luego, establecer este como principal
    const { error } = await supabase
      .from('jugador_equipos')
      .update({ es_principal: true })
      .eq('jugador_id', user.id)
      .eq('equipo_id', equipoId);

    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [establecerEquipoPrincipal] Error:', error);
    throw error;
  }
}

/**
 * Obtiene el equipo principal del jugador actual
 */
export async function obtenerEquipoPrincipal(): Promise<Equipo | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('jugador_equipos')
      .select(`
        equipo:equipos(*)
      `)
      .eq('jugador_id', user.id)
      .eq('es_principal', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No se encontró equipo principal
        return null;
      }
      throw error;
    }

    return (data as any)?.equipo as Equipo || null;
  } catch (error: any) {
    console.error('❌ [obtenerEquipoPrincipal] Error:', error);
    throw error;
  }
}
