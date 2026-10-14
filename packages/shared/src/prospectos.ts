import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateProspectoInput,
  ProspectoCancha,
  ProspectoVenue,
  UpdateProspectoInput,
} from './types';

export async function listarProspectos(
  supabase: SupabaseClient
): Promise<ProspectoVenue[]> {
  const { data, error } = await supabase
    .from('prospectos_venues')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []) as ProspectoVenue[];
}

export async function getProspecto(
  supabase: SupabaseClient,
  id: string
): Promise<ProspectoVenue | null> {
  const { data, error } = await supabase
    .from('prospectos_venues')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ProspectoVenue | null;
}

export async function crearProspecto(
  supabase: SupabaseClient,
  input: CreateProspectoInput
): Promise<ProspectoVenue> {
  const payload = {
    nombre: input.nombre,
    direccion_texto: input.direccion_texto ?? null,
    direccion_lat: input.direccion_lat,
    direccion_lng: input.direccion_lng,
    estado_comercial: input.estado_comercial ?? 'existente',
    complejo_id: input.complejo_id ?? null,
    notas: input.notas ?? null,
    contacto_nombre: input.contacto_nombre ?? null,
    contacto_telefono: input.contacto_telefono ?? null,
  };

  if (payload.complejo_id) {
    payload.estado_comercial = 'en_app';
  }

  const { data, error } = await supabase
    .from('prospectos_venues')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as ProspectoVenue;
}

export async function actualizarProspecto(
  supabase: SupabaseClient,
  id: string,
  input: UpdateProspectoInput
): Promise<ProspectoVenue> {
  const payload: Record<string, unknown> = { ...input };
  if (input.complejo_id) {
    payload.estado_comercial = input.estado_comercial ?? 'en_app';
  }

  const { data, error } = await supabase
    .from('prospectos_venues')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProspectoVenue;
}

export async function eliminarProspecto(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('prospectos_venues').delete().eq('id', id);
  if (error) throw error;
}

export async function listarCanchasDeComplejo(
  supabase: SupabaseClient,
  complejoId: string
): Promise<{ id: string; nombre: string; activo: boolean; jugadores_por_equipo: number | null; precio_por_hora: number | null }[]> {
  const { data, error } = await supabase
    .from('canchas')
    .select('id, nombre, activo, jugadores_por_equipo, precio_por_hora')
    .eq('complejo_id', complejoId)
    .order('nombre');

  if (error) throw error;
  return data || [];
}

export async function listarProspectoCanchas(
  supabase: SupabaseClient,
  prospectoId: string
): Promise<ProspectoCancha[]> {
  const { data, error } = await supabase
    .from('prospectos_canchas')
    .select('*')
    .eq('prospecto_id', prospectoId)
    .order('nombre');

  if (error) throw error;
  return (data || []) as ProspectoCancha[];
}

export async function crearProspectoCancha(
  supabase: SupabaseClient,
  prospectoId: string,
  nombre: string,
  notas?: string | null
): Promise<ProspectoCancha> {
  const { data, error } = await supabase
    .from('prospectos_canchas')
    .insert({
      prospecto_id: prospectoId,
      nombre,
      notas: notas ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProspectoCancha;
}

export async function eliminarProspectoCancha(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('prospectos_canchas').delete().eq('id', id);
  if (error) throw error;
}

export async function listarComplejosParaVincular(
  supabase: SupabaseClient
): Promise<{ id: string; nombre: string; direccion_lat: number | null; direccion_lng: number | null }[]> {
  const { data, error } = await supabase
    .from('complejos')
    .select('id, nombre, direccion_lat, direccion_lng')
    .order('nombre');

  if (error) throw error;
  return data || [];
}
