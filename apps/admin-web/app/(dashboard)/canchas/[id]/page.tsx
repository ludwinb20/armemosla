'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader } from '@/components/Loader';
import { CanchaForm, type CanchaFormValues } from '@/components/CanchaForm';
import { Switch } from '@/components/Switch';
import { createClient } from '@/lib/supabase/client';
import { uploadCanchaImage } from '@/lib/storage';
import {
  actualizarCanchaAdmin,
  agregarCanchaFotoAdmin,
  eliminarCanchaFotoAdmin,
  getCanchaAdmin,
  setCanchaDisponibilidadAdmin,
  type CanchaWithRelations,
} from '@armemosla/shared';

export default function EditarCanchaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [cancha, setCancha] = useState<CanchaWithRelations | null>(null);
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCanchaAdmin(createClient(), id);
      if (!data) {
        setError('Cancha no encontrada');
        return;
      }
      setCancha(data);
      setActivo(data.activo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(values: CanchaFormValues) {
    setBusy(true);
    try {
      const supabase = createClient();
      await actualizarCanchaAdmin(supabase, id, {
        complejo_id: values.complejo_id,
        nombre: values.nombre,
        largo: values.largo,
        ancho: values.ancho,
        jugadores_por_equipo: values.jugadores_por_equipo,
        precio_por_hora: values.precio_por_hora,
        activo: values.activo,
      });
      await setCanchaDisponibilidadAdmin(supabase, id, values.disponibilidad);

      const existingIds = new Set((cancha?.fotos ?? []).map((f) => f.id));
      const keptIds = new Set(values.fotos_existentes.map((f) => f.id));
      for (const fotoId of existingIds) {
        if (!keptIds.has(fotoId)) {
          await eliminarCanchaFotoAdmin(supabase, fotoId);
        }
      }

      let orden = 0;
      for (const item of values.fotos_existentes) {
        await supabase.from('cancha_fotos').update({ orden }).eq('id', item.id);
        orden += 1;
      }

      for (const file of values.fotos_archivos) {
        const url = await uploadCanchaImage(supabase, id, file);
        await agregarCanchaFotoAdmin(supabase, id, url, orden);
        orden += 1;
      }

      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader />;
  if (error || !cancha) {
    return (
      <div className="stack">
        <p style={{ color: 'var(--danger)' }}>{error || 'No encontrada'}</p>
        <Link href="/canchas">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <Link
        href={`/complejos/${cancha.complejo_id}`}
        className="muted"
        style={{ fontSize: '0.9rem' }}
      >
        ← Volver al complejo
      </Link>

      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            {cancha.nombre}
          </h1>
          {cancha.complejo?.nombre ? (
            <p className="muted" style={{ margin: 0 }}>
              {cancha.complejo.nombre} · {activo ? 'Cancha activa' : 'Cancha inactiva'}
            </p>
          ) : null}
        </div>
        <Switch
          id="cancha-activo"
          label={activo ? 'Activa' : 'Inactiva'}
          checked={activo}
          disabled={busy}
          onChange={setActivo}
        />
      </div>

      <CanchaForm
        key={cancha.updated_at}
        initial={cancha}
        activo={activo}
        hideActivoField
        submitLabel={busy ? 'Guardando…' : 'Guardar cambios'}
        disabled={busy}
        onSubmit={onSubmit}
      />
    </div>
  );
}
