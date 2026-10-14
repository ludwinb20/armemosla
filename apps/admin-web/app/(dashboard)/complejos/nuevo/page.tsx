'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ComplejoForm } from '@/components/ComplejoForm';
import { createClient } from '@/lib/supabase/client';
import { uploadComplejoImage } from '@/lib/storage';
import { crearComplejoAdmin, agregarComplejoFotoAdmin } from '@armemosla/shared';

export default function NuevoComplejoPage() {
  const router = useRouter();

  return (
    <div className="stack">
      <div>
        <Link href="/complejos" className="muted" style={{ fontSize: '0.9rem' }}>
          ← Volver a complejos
        </Link>
        <h1 className="page-title">Nuevo complejo</h1>
      </div>

      <ComplejoForm
        submitLabel="Crear complejo"
        onSubmit={async (values) => {
          const supabase = createClient();
          const complejo = await crearComplejoAdmin(supabase, {
            admin_id: values.admin_id,
            nombre: values.nombre,
            logo_url: null,
            direccion_texto: values.direccion_texto,
            direccion_lat: values.direccion_lat,
            direccion_lng: values.direccion_lng,
            activo: values.activo,
          });

          let logoUrl: string | null = null;
          if (values.logo_archivo) {
            logoUrl = await uploadComplejoImage(supabase, complejo.id, values.logo_archivo, 'logo');
            await supabase.from('complejos').update({ logo_url: logoUrl }).eq('id', complejo.id);
          }

          let orden = 0;
          for (const file of values.fotos_archivos) {
            const url = await uploadComplejoImage(supabase, complejo.id, file, 'fotos');
            await agregarComplejoFotoAdmin(supabase, complejo.id, url, orden);
            orden += 1;
          }

          router.push(`/complejos/${complejo.id}`);
          router.refresh();
        }}
      />
    </div>
  );
}
