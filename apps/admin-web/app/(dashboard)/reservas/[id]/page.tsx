'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader } from '@/components/Loader';
import { ReservaForm } from '@/components/ReservaForm';
import { formatReservaFechaHora } from '@/lib/fechaHora';
import { createClient } from '@/lib/supabase/client';
import {
  RESERVA_ESTADO_LABELS,
  actualizarReservaAdmin,
  eliminarReservaAdmin,
  getReservaAdmin,
  type ReservaWithRelations,
} from '@armemosla/shared';

export default function EditarReservaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reserva, setReserva] = useState<ReservaWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getReservaAdmin(createClient(), id);
      if (!data) {
        setError('Reserva no encontrada');
        return;
      }
      setReserva(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete() {
    if (!window.confirm('¿Eliminar esta reserva permanentemente?')) return;
    setBusy(true);
    try {
      await eliminarReservaAdmin(createClient(), id);
      router.push('/reservas');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader />;
  if (error || !reserva) {
    return (
      <div className="stack">
        <p style={{ color: 'var(--danger)' }}>{error || 'No encontrada'}</p>
        <Link href="/reservas">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <Link href="/reservas" className="muted" style={{ fontSize: '0.9rem' }}>
        ← Volver a reservas
      </Link>

      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Editar reserva
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {formatReservaFechaHora(reserva.fecha_hora)} · {RESERVA_ESTADO_LABELS[reserva.estado]}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          style={{ width: 'auto' }}
          disabled={busy}
          onClick={() => void onDelete()}
        >
          Eliminar
        </button>
      </div>

      <ReservaForm
        key={reserva.updated_at}
        mode="edit"
        initial={reserva}
        disabled={busy}
        submitLabel={busy ? 'Guardando…' : 'Guardar cambios'}
        onSubmit={async (values) => {
          if (values.mode !== 'edit') return;
          setBusy(true);
          try {
            await actualizarReservaAdmin(createClient(), id, values);
            await load();
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
