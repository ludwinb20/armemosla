'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader } from '@/components/Loader';
import { formatReservaFechaHora } from '@/lib/fechaHora';
import { createClient } from '@/lib/supabase/client';
import {
  RESERVA_ESTADO_LABELS,
  listarCanchasAdmin,
  listarComplejosAdmin,
  listarReservasAdmin,
  type ReservaEstado,
  type ReservaWithRelations,
} from '@armemosla/shared';

type EstadoFiltro = ReservaEstado | 'todas';

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const now = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    desde: toLocalYmd(desde),
    hasta: toLocalYmd(now),
  };
}

function endOfDayUtcIso(dateYmd: string): string {
  return new Date(`${dateYmd}T23:59:59.999`).toISOString();
}

export default function ReservasPageClient() {
  const searchParams = useSearchParams();
  const defaults = defaultRange();

  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [complejos, setComplejos] = useState<{ id: string; nombre: string }[]>([]);
  const [canchas, setCanchas] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [estado, setEstado] = useState<EstadoFiltro>(
    (searchParams.get('estado') as EstadoFiltro) || 'todas'
  );
  const [complejoId, setComplejoId] = useState(searchParams.get('complejoId') ?? '');
  const [canchaId, setCanchaId] = useState(searchParams.get('canchaId') ?? '');
  const [fechaDesde, setFechaDesde] = useState(defaults.desde);
  const [fechaHasta, setFechaHasta] = useState(defaults.hasta);

  const loadMeta = useCallback(async () => {
    const supabase = createClient();
    const [comps, c] = await Promise.all([
      listarComplejosAdmin(supabase),
      listarCanchasAdmin(supabase, complejoId || undefined, { includeDisponibilidad: false }),
    ]);
    setComplejos(comps.map((x) => ({ id: x.id, nombre: x.nombre })));
    setCanchas(c.map((x) => ({ id: x.id, nombre: x.nombre })));
  }, [complejoId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const data = await listarReservasAdmin(supabase, {
        fechaDesde: new Date(`${fechaDesde}T00:00:00`).toISOString(),
        fechaHasta: endOfDayUtcIso(fechaHasta),
        estado,
        canchaId: canchaId || undefined,
        complejoId: complejoId || undefined,
        limit: 300,
      });
      setReservas(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, estado, canchaId, complejoId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return reservas;
    return reservas.filter((r) => {
      const cancha = r.cancha?.nombre ?? '';
      const complejo = r.cancha?.complejo?.nombre ?? '';
      const user = r.usuario?.full_name ?? r.usuario?.email ?? '';
      return (
        cancha.toLowerCase().includes(q) ||
        complejo.toLowerCase().includes(q) ||
        user.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [reservas, filtro]);

  function badgeClass(est: ReservaEstado): string {
    if (est === 'completada') return 'badge badge-success';
    if (est === 'cancelada') return 'badge badge-muted';
    return 'badge badge-warning';
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Reservas
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Consultar, crear y editar reservas de canchas
          </p>
        </div>
        <Link className="btn btn-primary" href="/reservas/nuevo" style={{ width: 'auto' }}>
          Nueva reserva
        </Link>
      </div>

      <div className="filters-stack">
        <div className="row filter-date-row">
          <div className="filter-date-range">
            <input
              className="input input--date"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              aria-label="Desde"
            />
            <span className="filter-date-range-sep" aria-hidden>
              –
            </span>
            <input
              className="input input--date"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              aria-label="Hasta"
            />
          </div>
        </div>

        <div className="row">
          <input
            className="input"
            style={{ maxWidth: 220 }}
            placeholder="Buscar…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 160 }}
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
          >
            <option value="todas">Todos los estados</option>
            {(Object.keys(RESERVA_ESTADO_LABELS) as ReservaEstado[]).map((k) => (
              <option key={k} value={k}>
                {RESERVA_ESTADO_LABELS[k]}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ maxWidth: 180 }}
            value={complejoId}
            onChange={(e) => {
              setComplejoId(e.target.value);
              setCanchaId('');
            }}
          >
            <option value="">Todos los complejos</option>
            {complejos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ maxWidth: 160 }}
            value={canchaId}
            onChange={(e) => setCanchaId(e.target.value)}
          >
            <option value="">Todas las canchas</option>
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      </div>

      {loading ? <Loader inline /> : null}
      {error ? (
        <div className="stack">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <p className="muted">
            Ejecutá <code>db_settings/62_admin_reservas.sql</code> en Supabase.
          </p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Cancha</th>
                <th>Usuario</th>
                <th>Origen</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No hay reservas en el rango seleccionado.
                  </td>
                </tr>
              ) : (
                filtradas.map((r) => (
                  <tr key={r.id}>
                    <td>{formatReservaFechaHora(r.fecha_hora)}</td>
                    <td>
                      <strong>{r.cancha?.nombre ?? '—'}</strong>
                      {r.cancha?.complejo?.nombre ? (
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          {r.cancha.complejo.nombre}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {r.made_by_player
                        ? r.usuario?.full_name?.trim() || r.usuario?.email || '—'
                        : '—'}
                    </td>
                    <td>{r.made_by_player ? 'Jugador' : 'Dueño'}</td>
                    <td>
                      <span className={badgeClass(r.estado)}>{RESERVA_ESTADO_LABELS[r.estado]}</span>
                    </td>
                    <td>
                      <Link className="btn" href={`/reservas/${r.id}`} style={{ padding: '0.4rem 0.75rem' }}>
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
