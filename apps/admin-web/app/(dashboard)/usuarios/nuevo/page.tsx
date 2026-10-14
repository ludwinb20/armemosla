'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UsuarioForm, type UsuarioFormValues } from '@/components/UsuarioForm';

export default function NuevoUsuarioPage() {
  const router = useRouter();

  return (
    <div className="stack">
      <div>
        <Link href="/usuarios" className="muted" style={{ fontSize: '0.9rem' }}>
          ← Volver a usuarios
        </Link>
        <h1 className="page-title">Nuevo usuario</h1>
      </div>

      <UsuarioForm
        mode="create"
        onSubmit={async (values) => {
          if (values.mode !== 'create') return;

          const res = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: values.email,
              password: values.password,
              full_name: values.full_name,
              phone: values.phone,
              user_type: values.user_type,
              es_admin_plataforma: values.es_admin_plataforma,
            }),
          });

          const data = (await res.json()) as { error?: string; user?: { id: string } };
          if (!res.ok) {
            throw new Error(data.error ?? 'No se pudo crear el usuario');
          }

          router.push(`/usuarios/${data.user?.id ?? ''}`);
          router.refresh();
        }}
      />
    </div>
  );
}
