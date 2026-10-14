import { NextResponse } from 'next/server';
import type { AppUserRole } from '@armemosla/shared';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { createServiceClient } from '@/lib/supabase/service';

interface CreateBody {
  email?: string;
  password?: string;
  full_name?: string | null;
  phone?: string | null;
  user_type?: AppUserRole;
  es_admin_plataforma?: boolean;
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth && auth.error) return auth.error;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const userType = body.user_type;

  if (!email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }
  if (userType !== 'Jugador' && userType !== 'Administrador de Cancha') {
    return NextResponse.json({ error: 'Tipo de usuario inválido' }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name?.trim() || '',
      },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? 'No se pudo crear el usuario' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .update({
        full_name: body.full_name?.trim() || null,
        phone: body.phone?.trim() || null,
        user_type: userType,
        es_admin_plataforma: body.es_admin_plataforma ?? false,
        email,
      })
      .eq('id', created.user.id)
      .select('*')
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ user: profile }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al crear usuario';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
