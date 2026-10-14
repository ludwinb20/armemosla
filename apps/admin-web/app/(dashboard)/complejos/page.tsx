'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import {
  listarAdminsCancha,
  listarComplejosAdmin,
  listarCanchasAdmin,
  type AdminCanchaOwner,
  type Complejo,
} from '@armemosla/shared';

function ownerLabel(owner: AdminCanchaOwner | undefined): string {
  if (!owner) return '—';
  return owner.full_name?.trim() || owner.email || owner.id.slice(0, 8);
}

export default function ComplejosPage() {
  const [complejos, setComplejos] = useState<Complejo[]>([]);
  const [owners, setOwners] = useState<AdminCanchaOwner[]>([]);
  const [canchasCount, setCanchasCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [c, o, canchas] = await Promise.all([
        listarComplejosAdmin(supabase),
        listarAdminsCancha(supabase),
        listarCanchasAdmin(supabase, undefined, { includeDisponibilidad: false }),
      ]);
      setComplejos(c);
      setOwners(o);
      const counts: Record<string, number> = {};
      for (const cancha of canchas) {
        counts[cancha.complejo_id] = (counts[cancha.complejo_id] ?? 0) + 1;
      }
      setCanchasCount(counts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar complejos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ownersById = useMemo(
    () => Object.fromEntries(owners.map((o) => [o.id, o])),
    [owners]
  );

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return complejos;
    return complejos.filter((c) => {
      const owner = ownersById[c.admin_id];
      return (
        c.nombre.toLowerCase().includes(q) ||
        (c.direccion_texto?.toLowerCase().includes(q) ?? false) ||
        ownerLabel(owner).toLowerCase().includes(q) ||
        (owner?.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [complejos, filtro, ownersById]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Complejos
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Registrar y editar complejos de dueños de cancha
          </p>
        </div>
        <Link className="btn btn-primary" href="/complejos/nuevo" style={{ width: 'auto' }}>
          Nuevo complejo
        </Link>
      </div>

      <div className="row">
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar por nombre, dirección o dueño…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <button type="button" className="btn" onClick={() => void load()}>
          Actualizar
        </button>
      </div>

      {loading ? <Loader inline /> : null}
      {error ? (
        <div className="stack">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <p className="muted">
            Si falla por permisos, ejecutá <code>db_settings/58_admin_complejos_canchas.sql</code> en
            Supabase.
          </p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dueño</th>
                <th>Canchas</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No hay complejos registrados.
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="complejo-row-name">
                        {c.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logo_url} alt="" className="complejo-row-logo" />
                        ) : null}
                        <div>
                          <strong>{c.nombre}</strong>
                          {c.direccion_texto ? (
                            <div className="muted" style={{ fontSize: '0.85rem' }}>
                              {c.direccion_texto}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{ownerLabel(ownersById[c.admin_id])}</td>
                    <td>{canchasCount[c.id] ?? 0}</td>
                    <td>
                      <div className="row" style={{ gap: '0.35rem' }}>
                        <span className={`badge ${c.activo ? 'badge-success' : 'badge-muted'}`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        {c.oculto ? (
                          <span className="badge badge-warning">Oculto (mora)</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <Link className="btn" href={`/complejos/${c.id}`} style={{ padding: '0.4rem 0.75rem' }}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
