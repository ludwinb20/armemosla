import type { SupabaseClient } from '@supabase/supabase-js';

export type ReservaEstado = 'pendiente' | 'completada' | 'cancelada';

export const RESERVA_ESTADO_LABELS: Record<ReservaEstado, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export interface Reserva {
  id: string;
  cancha_id: string;
  fecha_hora: string;
  user_id: string | null;
  made_by_player: boolean;
  estado: ReservaEstado;
  canje_recompensa_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservaWithRelations extends Reserva {
  cancha?: {
    id: string;
    nombre: string;
    precio_por_hora?: number;
    complejo?: { id: string; nombre: string };
  };
  usuario?: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
}

export interface ListarReservasFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: ReservaEstado | 'todas';
  canchaId?: string;
  complejoId?: string;
  limit?: number;
}

export interface CreateReservaAdminInput {
  cancha_id: string;
  fecha_hora: string;
  made_by_player: boolean;
  user_id?: string | null;
}

export interface UpdateReservaAdminInput {
  cancha_id?: string;
  fecha_hora?: string;
  made_by_player?: boolean;
  user_id?: string | null;
  estado?: ReservaEstado;
}

const RESERVA_SELECT = `
  *,
  cancha:canchas!reservas_cancha_id_fkey (
    id,
    nombre,
    precio_por_hora,
    complejo_id,
    complejo:complejos!canchas_complejo_id_fkey (
      id,
      nombre
    )
  ),
  usuario:profiles (
    id,
    email,
    full_name
  )
`;

export async function validarDisponibilidadAdmin(
  supabase: SupabaseClient,
  canchaId: string,
  fechaHora: string,
  reservaId?: string
): Promise<boolean> {
  const fechaHoraInicio = new Date(fechaHora);
  const fechaHoraFin = new Date(fechaHoraInicio.getTime() + 60 * 60 * 1000);
  const fechaInicioBusqueda = new Date(fechaHoraInicio.getTime() - 60 * 60 * 1000);
  const fechaFinBusqueda = new Date(fechaHoraFin.getTime() + 60 * 60 * 1000);

  let query = supabase
    .from('reservas')
    .select('id, fecha_hora')
    .eq('cancha_id', canchaId)
    .eq('estado', 'pendiente')
    .gte('fecha_hora', fechaInicioBusqueda.toISOString())
    .lte('fecha_hora', fechaFinBusqueda.toISOString());

  if (reservaId) query = query.neq('id', reservaId);

  const { data: reservas, error } = await query;
  if (error) throw error;

  const hayConflicto = (reservas || []).some((reserva) => {
    const inicio = new Date(reserva.fecha_hora);
    const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
    return (
      (fechaHoraInicio >= inicio && fechaHoraInicio < fin) ||
      (fechaHoraFin > inicio && fechaHoraFin <= fin) ||
      (fechaHoraInicio <= inicio && fechaHoraFin >= fin)
    );
  });

  return !hayConflicto;
}

export async function listarReservasAdmin(
  supabase: SupabaseClient,
  filters: ListarReservasFilters = {}
): Promise<ReservaWithRelations[]> {
  let query = supabase
    .from('reservas')
    .select(RESERVA_SELECT)
    .order('fecha_hora', { ascending: false });

  if (filters.fechaDesde) query = query.gte('fecha_hora', filters.fechaDesde);
  if (filters.fechaHasta) query = query.lte('fecha_hora', filters.fechaHasta);
  if (filters.estado && filters.estado !== 'todas') {
    query = query.eq('estado', filters.estado);
  }
  if (filters.canchaId) query = query.eq('cancha_id', filters.canchaId);

  const limit = filters.limit ?? 200;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data || []) as ReservaWithRelations[];
  if (filters.complejoId) {
    rows = rows.filter((r) => r.cancha?.complejo?.id === filters.complejoId);
  }
  return rows;
}

export async function getReservaAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<ReservaWithRelations | null> {
  const { data, error } = await supabase
    .from('reservas')
    .select(RESERVA_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ReservaWithRelations | null;
}

function normalizeReservaPayload(input: CreateReservaAdminInput | UpdateReservaAdminInput) {
  const madeByPlayer = input.made_by_player ?? false;
  return {
    made_by_player: madeByPlayer,
    user_id: madeByPlayer ? input.user_id ?? null : null,
  };
}

export async function crearReservaAdmin(
  supabase: SupabaseClient,
  input: CreateReservaAdminInput
): Promise<Reserva> {
  const norm = normalizeReservaPayload(input);
  if (norm.made_by_player && !norm.user_id) {
    throw new Error('Seleccioná un jugador para la reserva');
  }

  const disponible = await validarDisponibilidadAdmin(
    supabase,
    input.cancha_id,
    input.fecha_hora
  );
  if (!disponible) throw new Error('La cancha no está disponible en ese horario');

  const { data, error } = await supabase
    .from('reservas')
    .insert({
      cancha_id: input.cancha_id,
      fecha_hora: input.fecha_hora,
      made_by_player: norm.made_by_player,
      user_id: norm.user_id,
      estado: 'pendiente',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Reserva;
}

export async function actualizarReservaAdmin(
  supabase: SupabaseClient,
  id: string,
  input: UpdateReservaAdminInput
): Promise<Reserva> {
  const current = await getReservaAdmin(supabase, id);
  if (!current) throw new Error('Reserva no encontrada');

  const canchaId = input.cancha_id ?? current.cancha_id;
  const fechaHora = input.fecha_hora ?? current.fecha_hora;
  const madeByPlayer = input.made_by_player ?? current.made_by_player;
  const userId =
    input.user_id !== undefined
      ? input.user_id
      : madeByPlayer
        ? current.user_id
        : null;

  if (madeByPlayer && !userId) {
    throw new Error('Seleccioná un jugador para la reserva');
  }

  if (input.fecha_hora || input.cancha_id) {
    const disponible = await validarDisponibilidadAdmin(
      supabase,
      canchaId,
      fechaHora,
      id
    );
    if (!disponible) throw new Error('La cancha no está disponible en ese horario');
  }

  const payload: Record<string, unknown> = {
    cancha_id: canchaId,
    fecha_hora: fechaHora,
    made_by_player: madeByPlayer,
    user_id: madeByPlayer ? userId : null,
  };
  if (input.estado !== undefined) payload.estado = input.estado;

  const { data, error } = await supabase
    .from('reservas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Reserva;
}

export async function eliminarReservaAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('reservas').delete().eq('id', id);
  if (error) throw error;
}
