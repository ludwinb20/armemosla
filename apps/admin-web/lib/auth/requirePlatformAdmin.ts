import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  const { data: isAdmin, error: rpcError } = await supabase.rpc('es_admin_plataforma');
  if (rpcError || !isAdmin) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return { supabase, user };
}
