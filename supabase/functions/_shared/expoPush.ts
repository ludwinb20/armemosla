import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const ANDROID_CHANNEL_ID = 'default';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
  channelId?: string;
}

export async function fetchTokensForUsers(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return [];

  const { data, error } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .in('user_id', unique);

  if (error) {
    console.error('[expoPush] fetchTokensForUsers:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row.expo_push_token as string)
    .filter((token) => Boolean(token));
}

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[expoPush] Expo push error:', text);
  }
}

export async function sendToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  const tokens = await fetchTokensForUsers(supabase, userIds);
  if (!tokens.length) return 0;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    channelId: ANDROID_CHANNEL_ID,
  }));

  await sendExpoPush(messages);
  return messages.length;
}

export async function fetchPlatformAdminIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('es_admin_plataforma', true);
  return (data ?? []).map((row) => row.id as string);
}

export async function fetchEquipoMemberIds(
  supabase: SupabaseClient,
  equipoId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('jugador_equipos')
    .select('jugador_id')
    .eq('equipo_id', equipoId);
  return (data ?? []).map((row) => row.jugador_id as string);
}

export function formatProfileLabel(profile: { full_name?: string | null; email?: string | null } | null): string {
  if (!profile) return 'Usuario';
  return profile.full_name?.trim() || profile.email?.trim() || 'Usuario';
}

export function formatFechaHoraHN(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-HN', {
      timeZone: 'America/Tegucigalpa',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatMontoLempiras(monto: number | string): string {
  const n = Number(monto);
  if (Number.isNaN(n)) return String(monto);
  return `L ${n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
