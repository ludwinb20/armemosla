'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ReservaForm } from '@/components/ReservaForm';
import { createClient } from '@/lib/supabase/client';
import { crearReservaAdmin } from '@armemosla/shared';

export default function NuevaReservaPage() {
  const router = useRouter();

  return (
    <div className="stack">
      <div>
        <Link href="/reservas" className="muted" style={{ fontSize: '0.9rem' }}>
          ← Volver a reservas
        </Link>
        <h1 className="page-title">Nueva reserva</h1>
      </div>

      <ReservaForm
        mode="create"
        onSubmit={async (values) => {
          if (values.mode !== 'create') return;
          const reserva = await crearReservaAdmin(createClient(), values);
          router.push(`/reservas/${reserva.id}`);
          router.refresh();
        }}
      />
    </div>
  );
}
