'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader } from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import {
  listarComplejosAdmin,
  listarCanchasAdmin,
  type CanchaWithRelations,
  type Complejo,
} from '@armemosla/shared';

function formatPrecio(value: number): string {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CanchasPageClient() {
  const searchParams = useSearchParams();
  const complejoFilter = searchParams.get('complejoId') ?? '';

  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [complejos, setComplejos] = useState<Complejo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [complejoId, setComplejoId] = useState(complejoFilter);
  const [soloActivas, setSoloActivas] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [c, comps] = await Promise.all([
        listarCanchasAdmin(supabase, complejoId || undefined, { includeDisponibilidad: false }),
        listarComplejosAdmin(supabase),
      ]);
      setCanchas(c);
      setComplejos(comps);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar canchas');
    } finally {
      setLoading(false);
    }
  }, [complejoId]);

  useEffect(() => {
    setComplejoId(complejoFilter);
  }, [complejoFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const complejosById = useMemo(
    () => Object.fromEntries(complejos.map((c) => [c.id, c])),
    [complejos]
  );

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return canchas.filter((c) => {
      if (soloActivas && !c.activo) return false;
      if (!q) return true;
      const complejoNombre = c.complejo?.nombre ?? complejosById[c.complejo_id]?.nombre ?? '';
      return (
        c.nombre.toLowerCase().includes(q) ||
        complejoNombre.toLowerCase().includes(q)
      );
    });
  }, [canchas, filtro, soloActivas, complejosById]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Canchas
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Registrar y editar canchas de los complejos
          </p>
        </div>
        <Link
          className="btn btn-primary"
          href={complejoId ? `/canchas/nuevo?complejoId=${complejoId}` : '/canchas/nuevo'}
          style={{ width: 'auto' }}
        >
          Nueva cancha
        </Link>
      </div>

      <div className="row">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nombre o complejo…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 220 }}
          value={complejoId}
          onChange={(e) => setComplejoId(e.target.value)}
        >
          <option value="">Todos los complejos</option>
          {complejos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={soloActivas}
            onChange={(e) => setSoloActivas(e.target.checked)}
          />
          <span>Solo activas</span>
        </label>
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
                <th>Complejo</th>
                <th>Precio/h</th>
                <th>Jugadores</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No hay canchas registradas.
                  </td>
                </tr>
              ) : (
                filtradas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.nombre}</strong>
                      {c.largo && c.ancho ? (
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          {c.largo}m × {c.ancho}m
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Link href={`/complejos/${c.complejo_id}`} className="link-accent">
                        {c.complejo?.nombre ?? complejosById[c.complejo_id]?.nombre ?? '—'}
                      </Link>
                    </td>
                    <td>{formatPrecio(Number(c.precio_por_hora))}</td>
                    <td>
                      {c.jugadores_por_equipo} vs {c.jugadores_por_equipo}
                    </td>
                    <td>
                      <span className={`badge ${c.activo ? 'badge-success' : 'badge-muted'}`}>
                        {c.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <Link className="btn" href={`/canchas/${c.id}`} style={{ padding: '0.4rem 0.75rem' }}>
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
