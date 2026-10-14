import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminCanchaOwner {
  id: string;
  email: string | null;
  full_name: string | null;
}

export interface Complejo {
  id: string;
  admin_id: string;
  nombre: string;
  logo_url?: string | null;
  direccion_texto?: string | null;
  direccion_lat?: number | null;
  direccion_lng?: number | null;
  activo: boolean;
  oculto?: boolean;
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

export interface Cancha {
  id: string;
  complejo_id: string;
  nombre: string;
  largo?: number | null;
  ancho?: number | null;
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
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  created_at: string;
}

export interface CanchaWithRelations extends Cancha {
  fotos?: CanchaFoto[];
  disponibilidad?: CanchaDisponibilidad[];
  complejo?: { id: string; nombre: string };
}

export interface CreateComplejoInput {
  admin_id: string;
  nombre: string;
  logo_url?: string | null;
  direccion_texto?: string | null;
  direccion_lat: number;
  direccion_lng: number;
  activo?: boolean;
}

export interface UpdateComplejoInput {
  admin_id?: string;
  nombre?: string;
  logo_url?: string | null;
  direccion_texto?: string | null;
  direccion_lat?: number;
  direccion_lng?: number;
  activo?: boolean;
}

export interface CreateCanchaInput {
  complejo_id: string;
  nombre: string;
  largo?: number | null;
  ancho?: number | null;
  jugadores_por_equipo: number;
  precio_por_hora: number;
  activo?: boolean;
}

export interface UpdateCanchaInput {
  complejo_id?: string;
  nombre?: string;
  largo?: number | null;
  ancho?: number | null;
  jugadores_por_equipo?: number;
  precio_por_hora?: number;
  activo?: boolean;
}

export interface DisponibilidadInput {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export const DIAS_SEMANA = [
  { id: 0, nombre: 'Lunes' },
  { id: 1, nombre: 'Martes' },
  { id: 2, nombre: 'Miércoles' },
  { id: 3, nombre: 'Jueves' },
  { id: 4, nombre: 'Viernes' },
  { id: 5, nombre: 'Sábado' },
  { id: 6, nombre: 'Domingo' },
] as const;

export async function listarAdminsCancha(
  supabase: SupabaseClient
): Promise<AdminCanchaOwner[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('user_type', 'Administrador de Cancha')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data || []) as AdminCanchaOwner[];
}

export async function listarComplejosAdmin(
  supabase: SupabaseClient
): Promise<Complejo[]> {
  const { data, error } = await supabase
    .from('complejos')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []) as Complejo[];
}

export async function getComplejoAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<ComplejoWithFotos | null> {
  const { data: complejo, error } = await supabase
    .from('complejos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!complejo) return null;

  const { data: fotos } = await supabase
    .from('complejo_fotos')
    .select('*')
    .eq('complejo_id', id)
    .order('orden', { ascending: true });

  return { ...(complejo as Complejo), fotos: fotos || [] };
}

export async function crearComplejoAdmin(
  supabase: SupabaseClient,
  input: CreateComplejoInput
): Promise<Complejo> {
  const { data, error } = await supabase
    .from('complejos')
    .insert({
      admin_id: input.admin_id,
      nombre: input.nombre.trim(),
      logo_url: input.logo_url?.trim() || null,
      direccion_texto: input.direccion_texto?.trim() || null,
      direccion_lat: input.direccion_lat,
      direccion_lng: input.direccion_lng,
      activo: input.activo ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Complejo;
}

export async function actualizarComplejoAdmin(
  supabase: SupabaseClient,
  id: string,
  input: UpdateComplejoInput
): Promise<Complejo> {
  const payload: Record<string, unknown> = {};
  if (input.admin_id !== undefined) payload.admin_id = input.admin_id;
  if (input.nombre !== undefined) payload.nombre = input.nombre.trim();
  if (input.logo_url !== undefined) payload.logo_url = input.logo_url?.trim() || null;
  if (input.direccion_texto !== undefined) {
    payload.direccion_texto = input.direccion_texto?.trim() || null;
  }
  if (input.direccion_lat !== undefined) payload.direccion_lat = input.direccion_lat;
  if (input.direccion_lng !== undefined) payload.direccion_lng = input.direccion_lng;
  if (input.activo !== undefined) payload.activo = input.activo;

  const { data, error } = await supabase
    .from('complejos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Complejo;
}

export async function agregarComplejoFotoAdmin(
  supabase: SupabaseClient,
  complejoId: string,
  fotoUrl: string,
  orden = 0
): Promise<ComplejoFoto> {
  const { data, error } = await supabase
    .from('complejo_fotos')
    .insert({ complejo_id: complejoId, foto_url: fotoUrl.trim(), orden })
    .select()
    .single();

  if (error) throw error;
  return data as ComplejoFoto;
}

export async function eliminarComplejoFotoAdmin(
  supabase: SupabaseClient,
  fotoId: string
): Promise<void> {
  const { error } = await supabase.from('complejo_fotos').delete().eq('id', fotoId);
  if (error) throw error;
}

export async function listarCanchasAdmin(
  supabase: SupabaseClient,
  complejoId?: string,
  options?: { includeDisponibilidad?: boolean }
): Promise<CanchaWithRelations[]> {
  const includeDisponibilidad = options?.includeDisponibilidad ?? true;

  let query = supabase
    .from('canchas')
    .select(`
      *,
      complejo:complejos!canchas_complejo_id_fkey (id, nombre)
    `)
    .order('nombre', { ascending: true });

  if (complejoId) {
    query = query.eq('complejo_id', complejoId);
  }

  const { data: canchas, error } = await query;
  if (error) throw error;

  const rows = (canchas || []) as CanchaWithRelations[];

  if (!includeDisponibilidad) {
    return rows;
  }

  return Promise.all(
    rows.map(async (cancha) => {
      const { data: disp } = await supabase
        .from('cancha_disponibilidad')
        .select('*')
        .eq('cancha_id', cancha.id)
        .order('dia_semana', { ascending: true });

      return { ...cancha, disponibilidad: disp || [] };
    })
  );
}

export async function getCanchaAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<CanchaWithRelations | null> {
  const { data: cancha, error } = await supabase
    .from('canchas')
    .select(`
      *,
      complejo:complejos!canchas_complejo_id_fkey (id, nombre)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!cancha) return null;

  const [fotosResult, dispResult] = await Promise.all([
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
    ...(cancha as CanchaWithRelations),
    fotos: fotosResult.data || [],
    disponibilidad: dispResult.data || [],
  };
}

export async function crearCanchaAdmin(
  supabase: SupabaseClient,
  input: CreateCanchaInput
): Promise<Cancha> {
  const { data, error } = await supabase
    .from('canchas')
    .insert({
      complejo_id: input.complejo_id,
      nombre: input.nombre.trim(),
      largo: input.largo ?? null,
      ancho: input.ancho ?? null,
      jugadores_por_equipo: input.jugadores_por_equipo,
      precio_por_hora: input.precio_por_hora,
      activo: input.activo ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Cancha;
}

export async function actualizarCanchaAdmin(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCanchaInput
): Promise<Cancha> {
  const payload: Record<string, unknown> = {};
  if (input.complejo_id !== undefined) payload.complejo_id = input.complejo_id;
  if (input.nombre !== undefined) payload.nombre = input.nombre.trim();
  if (input.largo !== undefined) payload.largo = input.largo;
  if (input.ancho !== undefined) payload.ancho = input.ancho;
  if (input.jugadores_por_equipo !== undefined) {
    payload.jugadores_por_equipo = input.jugadores_por_equipo;
  }
  if (input.precio_por_hora !== undefined) payload.precio_por_hora = input.precio_por_hora;
  if (input.activo !== undefined) payload.activo = input.activo;

  const { data, error } = await supabase
    .from('canchas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Cancha;
}

export async function setCanchaDisponibilidadAdmin(
  supabase: SupabaseClient,
  canchaId: string,
  disponibilidad: DisponibilidadInput[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('cancha_disponibilidad')
    .delete()
    .eq('cancha_id', canchaId);

  if (delError) throw delError;

  if (disponibilidad.length === 0) return;

  const { error } = await supabase.from('cancha_disponibilidad').insert(
    disponibilidad.map((d) => ({
      cancha_id: canchaId,
      dia_semana: d.dia_semana,
      hora_inicio: d.hora_inicio,
      hora_fin: d.hora_fin,
    }))
  );

  if (error) throw error;
}

export async function agregarCanchaFotoAdmin(
  supabase: SupabaseClient,
  canchaId: string,
  fotoUrl: string,
  orden = 0
): Promise<CanchaFoto> {
  const { data, error } = await supabase
    .from('cancha_fotos')
    .insert({ cancha_id: canchaId, foto_url: fotoUrl.trim(), orden })
    .select()
    .single();

  if (error) throw error;
  return data as CanchaFoto;
}

export async function eliminarCanchaFotoAdmin(
  supabase: SupabaseClient,
  fotoId: string
): Promise<void> {
  const { error } = await supabase.from('cancha_fotos').delete().eq('id', fotoId);
  if (error) throw error;
}
