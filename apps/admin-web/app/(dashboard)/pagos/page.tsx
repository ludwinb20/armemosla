'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader } from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import {
  aprobarSolicitudReembolso,
  confirmarTransferencia,
  listarPagosPendientes,
  listarSolicitudesReembolsoPendientes,
  listarTransferenciasConfirmadas,
  rechazarSolicitudReembolso,
  rechazarTransferencia,
  type SolicitudReembolsoPendiente,
  type TransferenciaPendiente,
} from '@armemosla/shared';

export default function PagosPage() {
  const [pendientes, setPendientes] = useState<TransferenciaPendiente[]>([]);
  const [confirmadas, setConfirmadas] = useState<TransferenciaPendiente[]>([]);
  const [reembolsos, setReembolsos] = useState<SolicitudReembolsoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [p, c, r] = await Promise.all([
        listarPagosPendientes(supabase),
        listarTransferenciasConfirmadas(supabase),
        listarSolicitudesReembolsoPendientes(supabase),
      ]);
      setPendientes(p);
      setConfirmadas(c);
      setReembolsos(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onConfirm(id: string) {
    setBusyId(id);
    try {
      await confirmarTransferencia(createClient(), id);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al confirmar');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    const motivo = window.prompt('Motivo del rechazo:');
    if (!motivo?.trim()) return;
    setBusyId(id);
    try {
      await rechazarTransferencia(createClient(), id, motivo.trim());
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al rechazar');
    } finally {
      setBusyId(null);
    }
  }

  async function onAprobarReembolso(id: string) {
    const msg = window.prompt('Mensaje visible para el dueño:');
    if (!msg?.trim()) return;
    setBusyId(id);
    try {
      await aprobarSolicitudReembolso(createClient(), id, msg.trim());
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  async function onRechazarReembolso(id: string) {
    const msg = window.prompt('Respuesta / motivo:');
    if (!msg?.trim()) return;
    setBusyId(id);
    try {
      await rechazarSolicitudReembolso(createClient(), id, msg.trim());
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loader label="Cargando pagos…" />;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Revisión de pagos
        </h1>
        <button type="button" className="btn" onClick={() => void load()}>
          Actualizar
        </button>
      </div>

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          Pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="muted">No hay transferencias pendientes.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Monto</th>
                <th># Transacción</th>
                <th>Factura</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendientes.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div>{t.admin_nombre || '—'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t.admin_email}
                    </div>
                  </td>
                  <td>L {Number(t.monto_aplicado || t.monto).toFixed(2)}</td>
                  <td>{t.numero_transaccion}</td>
                  <td>
                    {t.factura
                      ? `${t.factura.mes}/${t.factura.año} · ${t.factura.estado_pago}`
                      : '—'}
                  </td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === t.id}
                        onClick={() => void onConfirm(t.id)}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === t.id}
                        onClick={() => void onReject(t.id)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          Solicitudes de reembolso ({reembolsos.length})
        </h2>
        {reembolsos.length === 0 ? (
          <p className="muted">Sin solicitudes pendientes.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Monto</th>
                <th>Motivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reembolsos.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.admin_nombre || '—'}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.admin_email}
                    </div>
                  </td>
                  <td>L {Number(s.monto).toFixed(2)}</td>
                  <td>{s.motivo}</td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === s.id}
                        onClick={() => void onAprobarReembolso(s.id)}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === s.id}
                        onClick={() => void onRechazarReembolso(s.id)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          Confirmadas recientes ({confirmadas.length})
        </h2>
        {confirmadas.length === 0 ? (
          <p className="muted">Sin confirmadas recientes.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Monto</th>
                <th># Transacción</th>
                <th>Revisado</th>
              </tr>
            </thead>
            <tbody>
              {confirmadas.map((t) => (
                <tr key={t.id}>
                  <td>{t.admin_nombre || t.admin_email || '—'}</td>
                  <td>L {Number(t.monto_aplicado || t.monto).toFixed(2)}</td>
                  <td>{t.numero_transaccion}</td>
                  <td className="muted">
                    {t.revisado_at ? new Date(t.revisado_at).toLocaleString('es-HN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
