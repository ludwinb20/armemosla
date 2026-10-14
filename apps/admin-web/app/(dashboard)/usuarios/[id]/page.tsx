'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader } from '@/components/Loader';
import { UsuarioForm } from '@/components/UsuarioForm';
import { createClient } from '@/lib/supabase/client';
import {
  USER_TYPE_LABELS,
  actualizarUsuarioAdmin,
  getUsuarioAdmin,
  type UserProfile,
} from '@armemosla/shared';

export default function EditarUsuarioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [usuario, setUsuario] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsuarioAdmin(createClient(), id);
      if (!data) {
        setError('Usuario no encontrado');
        return;
      }
      setUsuario(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loader />;
  if (error || !usuario) {
    return (
      <div className="stack">
        <p style={{ color: 'var(--danger)' }}>{error || 'No encontrado'}</p>
        <Link href="/usuarios">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <Link href="/usuarios" className="muted" style={{ fontSize: '0.9rem' }}>
        ← Volver a usuarios
      </Link>

      <div>
        <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
          {usuario.full_name?.trim() || usuario.email || 'Usuario'}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {usuario.user_type ? USER_TYPE_LABELS[usuario.user_type] : 'Sin tipo asignado'}
          {usuario.es_admin_plataforma ? ' · Superadmin' : ''}
        </p>
      </div>

      <UsuarioForm
        key={usuario.updated_at}
        mode="edit"
        initial={usuario}
        disabled={busy}
        submitLabel={busy ? 'Guardando…' : 'Guardar cambios'}
        onSubmit={async (values) => {
          if (values.mode !== 'edit') return;
          setBusy(true);
          try {
            await actualizarUsuarioAdmin(createClient(), id, values);
            await load();
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
