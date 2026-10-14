'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader } from '@/components/Loader';
import { ComplejoForm, type ComplejoFormValues } from '@/components/ComplejoForm';
import { Switch } from '@/components/Switch';
import { createClient } from '@/lib/supabase/client';
import { uploadComplejoImage } from '@/lib/storage';
import {
  actualizarComplejoAdmin,
  agregarComplejoFotoAdmin,
  eliminarComplejoFotoAdmin,
  getComplejoAdmin,
  listarCanchasAdmin,
  type CanchaWithRelations,
  type ComplejoWithFotos,
} from '@armemosla/shared';

export default function EditarComplejoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [complejo, setComplejo] = useState<ComplejoWithFotos | null>(null);
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [c, canchasData] = await Promise.all([
        getComplejoAdmin(supabase, id),
        listarCanchasAdmin(supabase, id),
      ]);
      if (!c) {
        setError('Complejo no encontrado');
        return;
      }
      setComplejo(c);
      setActivo(c.activo);
      setCanchas(canchasData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(values: ComplejoFormValues) {
    setBusy(true);
    try {
      const supabase = createClient();

      let logoUrl = values.logo_removido ? null : values.logo_url;
      if (values.logo_archivo) {
        logoUrl = await uploadComplejoImage(supabase, id, values.logo_archivo, 'logo');
      }

      await actualizarComplejoAdmin(supabase, id, {
        admin_id: values.admin_id,
        nombre: values.nombre,
        logo_url: logoUrl,
        direccion_texto: values.direccion_texto,
        direccion_lat: values.direccion_lat,
        direccion_lng: values.direccion_lng,
        activo: values.activo,
      });

      const existingIds = new Set((complejo?.fotos ?? []).map((f) => f.id));
      const keptIds = new Set(values.fotos_existentes.map((f) => f.id));

      for (const fotoId of existingIds) {
        if (!keptIds.has(fotoId)) {
          await eliminarComplejoFotoAdmin(supabase, fotoId);
        }
      }

      let orden = 0;
      for (const item of values.fotos_existentes) {
        await supabase.from('complejo_fotos').update({ orden }).eq('id', item.id);
        orden += 1;
      }

      for (const file of values.fotos_archivos) {
        const url = await uploadComplejoImage(supabase, id, file, 'fotos');
        await agregarComplejoFotoAdmin(supabase, id, url, orden);
        orden += 1;
      }

      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader />;
  if (error || !complejo) {
    return (
      <div className="stack">
        <p style={{ color: 'var(--danger)' }}>{error || 'No encontrado'}</p>
        <Link href="/complejos">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <Link href="/complejos" className="muted" style={{ fontSize: '0.9rem' }}>
        ← Volver a complejos
      </Link>

      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            {complejo.nombre}
          </h1>
          {complejo.oculto ? (
            <p className="muted" style={{ margin: 0 }}>
              Oculto por mora de factura. Los jugadores no lo ven en la app.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {activo ? 'Complejo activo' : 'Complejo inactivo'}
            </p>
          )}
        </div>
        <Switch
          id="complejo-activo"
          label={activo ? 'Activo' : 'Inactivo'}
          checked={activo}
          disabled={busy}
          onChange={setActivo}
        />
      </div>

      <ComplejoForm
        key={complejo.updated_at}
        initial={complejo}
        activo={activo}
        hideActivoField
        submitLabel={busy ? 'Guardando…' : 'Guardar cambios'}
        disabled={busy}
        onSubmit={onSubmit}
      />

      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Canchas ({canchas.length})
          </h2>
          <div className="row">
            <Link className="btn" href={`/canchas?complejoId=${id}`} style={{ width: 'auto' }}>
              Ver todas
            </Link>
            <Link
              className="btn btn-primary"
              href={`/canchas/nuevo?complejoId=${id}`}
              style={{ width: 'auto' }}
            >
              Nueva cancha
            </Link>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Precio/h</th>
                <th>Jugadores</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {canchas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Sin canchas. Agregá la primera.
                  </td>
                </tr>
              ) : (
                canchas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>L {Number(c.precio_por_hora).toFixed(0)}</td>
                    <td>
                      {c.jugadores_por_equipo} vs {c.jugadores_por_equipo}
                    </td>
                    <td>
                      <span className={`badge ${c.activo ? 'badge-success' : 'badge-muted'}`}>
                        {c.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="btn"
                        href={`/canchas/${c.id}`}
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
