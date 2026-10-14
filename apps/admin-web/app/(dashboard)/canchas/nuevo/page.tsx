'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CanchaForm } from '@/components/CanchaForm';
import { Loader } from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import { uploadCanchaImage } from '@/lib/storage';
import {
  agregarCanchaFotoAdmin,
  crearCanchaAdmin,
  setCanchaDisponibilidadAdmin,
} from '@armemosla/shared';

function NuevaCanchaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const complejoId = searchParams.get('complejoId') ?? undefined;

  return (
    <div className="stack">
      <div>
        <Link
          href={complejoId ? `/complejos/${complejoId}` : '/canchas'}
          className="muted"
          style={{ fontSize: '0.9rem' }}
        >
          ← Volver
        </Link>
        <h1 className="page-title">Nueva cancha</h1>
      </div>

      <CanchaForm
        defaultComplejoId={complejoId}
        submitLabel="Crear cancha"
        onSubmit={async (values) => {
          const supabase = createClient();
          const cancha = await crearCanchaAdmin(supabase, values);
          await setCanchaDisponibilidadAdmin(supabase, cancha.id, values.disponibilidad);

          let orden = 0;
          for (const file of values.fotos_archivos) {
            const url = await uploadCanchaImage(supabase, cancha.id, file);
            await agregarCanchaFotoAdmin(supabase, cancha.id, url, orden);
            orden += 1;
          }

          router.push(complejoId ? `/complejos/${complejoId}` : `/canchas/${cancha.id}`);
          router.refresh();
        }}
      />
    </div>
  );
}

export default function NuevaCanchaPage() {
  return (
    <Suspense fallback={<Loader />}>
      <NuevaCanchaInner />
    </Suspense>
  );
}
