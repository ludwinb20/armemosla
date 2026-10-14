'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoToDateAndTimeInputs, localHNToUtcIso } from '@/lib/fechaHora';
import {
  RESERVA_ESTADO_LABELS,
  listarCanchasAdmin,
  listarUsuariosAdmin,
  type CreateReservaAdminInput,
  type ReservaEstado,
  type ReservaWithRelations,
  type UpdateReservaAdminInput,
} from '@armemosla/shared';

export type ReservaFormValues =
  | ({ mode: 'create' } & CreateReservaAdminInput)
  | ({ mode: 'edit' } & UpdateReservaAdminInput);

interface Props {
  initial?: ReservaWithRelations;
  mode: 'create' | 'edit';
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (values: ReservaFormValues) => Promise<void>;
}

export function ReservaForm({
  initial,
  mode,
  submitLabel,
  disabled = false,
  onSubmit,
}: Props) {
  const [canchas, setCanchas] = useState<
    { id: string; nombre: string; complejo?: { id: string; nombre: string } }[]
  >([]);
  const [jugadores, setJugadores] = useState<
    { id: string; label: string }[]
  >([]);

  const initialParts = initial?.fecha_hora ? isoToDateAndTimeInputs(initial.fecha_hora) : null;

  const [canchaId, setCanchaId] = useState(initial?.cancha_id ?? '');
  const [fecha, setFecha] = useState(initialParts?.date ?? '');
  const [hora, setHora] = useState(initialParts?.time ?? '18:00');
  const [madeByPlayer, setMadeByPlayer] = useState(initial?.made_by_player ?? true);
  const [userId, setUserId] = useState(initial?.user_id ?? '');
  const [estado, setEstado] = useState<ReservaEstado>(initial?.estado ?? 'pendiente');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      listarCanchasAdmin(supabase, undefined, { includeDisponibilidad: false }),
      listarUsuariosAdmin(supabase, 'Jugador'),
    ]).then(([c, j]) => {
      setCanchas(
        c.map((x) => ({
          id: x.id,
          nombre: x.nombre,
          complejo: x.complejo,
        }))
      );
      setJugadores(
        j.map((u) => ({
          id: u.id,
          label: u.full_name?.trim() || u.email || u.id.slice(0, 8),
        }))
      );
    });
  }, []);

  const canchasAgrupadas = useMemo(() => {
    const map = new Map<string, typeof canchas>();
    for (const c of canchas) {
      const key = c.complejo?.nombre ?? 'Sin complejo';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()];
  }, [canchas]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!canchaId) {
      setError('Seleccioná una cancha');
      return;
    }
    if (!fecha || !hora) {
      setError('Fecha y hora son obligatorias');
      return;
    }
    if (madeByPlayer && !userId) {
      setError('Seleccioná un jugador');
      return;
    }

    let fechaHora: string;
    try {
      const [hh, mm] = hora.split(':').map((x) => parseInt(x, 10));
      fechaHora = localHNToUtcIso(fecha, hh, mm);
    } catch {
      setError('Fecha u hora inválida');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await onSubmit({
          mode: 'create',
          cancha_id: canchaId,
          fecha_hora: fechaHora,
          made_by_player: madeByPlayer,
          user_id: madeByPlayer ? userId : null,
        });
      } else {
        await onSubmit({
          mode: 'edit',
          cancha_id: canchaId,
          fecha_hora: fechaHora,
          made_by_player: madeByPlayer,
          user_id: madeByPlayer ? userId : null,
          estado,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-card form-card--wide stack" onSubmit={(e) => void handleSubmit(e)}>
      <label className="field">
        <span className="field-label">Cancha *</span>
        <select
          className="input"
          value={canchaId}
          onChange={(e) => setCanchaId(e.target.value)}
          required
        >
          <option value="">Seleccionar…</option>
          {canchasAgrupadas.map(([complejoNombre, items]) => (
            <optgroup key={complejoNombre} label={complejoNombre}>
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="form-row-2">
        <label className="field">
          <span className="field-label">Fecha *</span>
          <input
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Hora * (Honduras)</span>
          <input
            className="input"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="field checkbox-field">
        <input
          type="checkbox"
          checked={madeByPlayer}
          onChange={(e) => {
            setMadeByPlayer(e.target.checked);
            if (!e.target.checked) setUserId('');
          }}
        />
        <span>Reserva hecha por jugador (requiere usuario)</span>
      </label>

      {madeByPlayer ? (
        <label className="field">
          <span className="field-label">Jugador *</span>
          <select
            className="input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {jugadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Bloqueo manual registrado por el dueño (sin jugador asociado).
        </p>
      )}

      {mode === 'edit' ? (
        <label className="field">
          <span className="field-label">Estado</span>
          <select
            className="input"
            value={estado}
            onChange={(e) => setEstado(e.target.value as ReservaEstado)}
          >
            {(Object.keys(RESERVA_ESTADO_LABELS) as ReservaEstado[]).map((k) => (
              <option key={k} value={k}>
                {RESERVA_ESTADO_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}

      <button type="submit" className="btn btn-primary" disabled={disabled || saving} style={{ maxWidth: 320 }}>
        {saving ? 'Guardando…' : submitLabel ?? (mode === 'create' ? 'Crear reserva' : 'Guardar cambios')}
      </button>
    </form>
  );
}
