import { supabase } from './supabase';

export interface CanjeRecompensa {
  id: string;
  recompensa_id: string;
  logro_id: string;
  reserva_id: string;
  cancha_id: string;
  admin_id: string;
  jugador_id: string;
  monto_descontado: number;
  logro_titulo: string;
  created_at: string;
  cancha?: { id: string; nombre: string };
  jugador?: { id: string; full_name?: string | null; email?: string | null };
}

export interface ResultadoCanjeQR {
  canje_id: string;
  jugador_nombre: string;
  logro_titulo: string;
  monto_descontado: number;
  reserva_id: string;
  cancha_id: string;
}

export async function canjearRecompensaQR(
  token: string,
  canchaId: string,
  reservaId: string
): Promise<ResultadoCanjeQR> {
  const { data, error } = await supabase.rpc('canjear_recompensa_qr', {
    p_token: token,
    p_cancha_id: canchaId,
    p_reserva_id: reservaId,
  });

  if (error) throw error;
  return data as ResultadoCanjeQR;
}

export async function obtenerCanjesMes(mes: number, año: number): Promise<CanjeRecompensa[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const inicio = new Date(año, mes - 1, 1);
  const fin = new Date(año, mes, 0, 23, 59, 59, 999);

  const { data, error } = await supabase
    .from('canjes_recompensa')
    .select(`
      *,
      cancha:canchas ( id, nombre ),
      jugador:profiles!canjes_recompensa_jugador_id_fkey ( id, full_name, email )
    `)
    .eq('admin_id', user.id)
    .gte('created_at', inicio.toISOString())
    .lte('created_at', fin.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item) => ({
    ...item,
    cancha: item.cancha as CanjeRecompensa['cancha'],
    jugador: item.jugador as CanjeRecompensa['jugador'],
  }));
}
