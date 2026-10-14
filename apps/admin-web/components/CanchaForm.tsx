'use client';

import { useEffect, useState } from 'react';
import { PhotoGrid } from '@/components/ImageDropzone';
import {
  DIAS_SEMANA,
  listarComplejosAdmin,
  type CanchaWithRelations,
  type CreateCanchaInput,
  type DisponibilidadInput,
} from '@armemosla/shared';
import { createClient } from '@/lib/supabase/client';

export interface CanchaFormValues extends CreateCanchaInput {
  disponibilidad: DisponibilidadInput[];
  fotos_existentes: { id: string; foto_url: string }[];
  fotos_archivos: File[];
}

interface Props {
  initial?: CanchaWithRelations;
  defaultComplejoId?: string;
  activo?: boolean;
  hideActivoField?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (values: CanchaFormValues) => Promise<void>;
}

type DispState = Record<number, { activo: boolean; hora_inicio: string; hora_fin: string }>;

function toTimeInput(value: string | undefined): string {
  if (!value) return '08:00';
  return value.slice(0, 5);
}

function buildDispState(initial?: CanchaWithRelations): DispState {
  const base: DispState = {};
  for (const dia of DIAS_SEMANA) {
    base[dia.id] = { activo: false, hora_inicio: '08:00', hora_fin: '22:00' };
  }
  for (const d of initial?.disponibilidad ?? []) {
    base[d.dia_semana] = {
      activo: true,
      hora_inicio: toTimeInput(d.hora_inicio),
      hora_fin: toTimeInput(d.hora_fin),
    };
  }
  return base;
}

export function CanchaForm({
  initial,
  defaultComplejoId,
  activo: activoProp,
  hideActivoField = false,
  submitLabel = 'Guardar',
  disabled = false,
  onSubmit,
}: Props) {
  const [complejos, setComplejos] = useState<{ id: string; nombre: string }[]>([]);
  const [complejoId, setComplejoId] = useState(initial?.complejo_id ?? defaultComplejoId ?? '');
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [largo, setLargo] = useState(initial?.largo?.toString() ?? '');
  const [ancho, setAncho] = useState(initial?.ancho?.toString() ?? '');
  const [jugadores, setJugadores] = useState(initial?.jugadores_por_equipo?.toString() ?? '5');
  const [precio, setPrecio] = useState(initial?.precio_por_hora?.toString() ?? '');
  const [activoInternal, setActivoInternal] = useState(initial?.activo ?? true);
  const [disp, setDisp] = useState<DispState>(() => buildDispState(initial));
  const [fotosExistentes, setFotosExistentes] = useState(
    initial?.fotos?.map((f) => ({ id: f.id, foto_url: f.foto_url })) ?? []
  );
  const [fotosPending, setFotosPending] = useState<{ id: string; file: File; url: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activo = activoProp ?? activoInternal;

  useEffect(() => {
    void listarComplejosAdmin(createClient())
      .then((data) => setComplejos(data.map((c) => ({ id: c.id, nombre: c.nombre }))))
      .catch(console.error);
  }, []);

  useEffect(() => {
    return () => {
      for (const p of fotosPending) URL.revokeObjectURL(p.url);
    };
  }, [fotosPending]);

  function addFoto(file: File) {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFotosPending((prev) => [...prev, { id, file, url: URL.createObjectURL(file) }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!complejoId) {
      setError('Seleccioná un complejo');
      return;
    }
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    const jugadoresNum = parseInt(jugadores, 10);
    const precioNum = parseFloat(precio);
    if (!Number.isFinite(jugadoresNum) || jugadoresNum <= 0) {
      setError('Jugadores por equipo debe ser mayor a 0');
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setError('Precio por hora inválido');
      return;
    }

    const disponibilidad: DisponibilidadInput[] = [];
    for (const dia of DIAS_SEMANA) {
      const row = disp[dia.id];
      if (!row?.activo) continue;
      if (row.hora_fin <= row.hora_inicio) {
        setError(`${dia.nombre}: la hora fin debe ser mayor que la de inicio`);
        return;
      }
      disponibilidad.push({
        dia_semana: dia.id,
        hora_inicio: row.hora_inicio,
        hora_fin: row.hora_fin,
      });
    }

    setSaving(true);
    try {
      await onSubmit({
        complejo_id: complejoId,
        nombre,
        largo: largo ? parseFloat(largo) : null,
        ancho: ancho ? parseFloat(ancho) : null,
        jugadores_por_equipo: jugadoresNum,
        precio_por_hora: precioNum,
        activo,
        disponibilidad,
        fotos_existentes: fotosExistentes,
        fotos_archivos: fotosPending.map((p) => p.file),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-card form-card--wide stack" onSubmit={(e) => void handleSubmit(e)}>
      <label className="field">
        <span className="field-label">Complejo *</span>
        <select
          className="input"
          value={complejoId}
          onChange={(e) => setComplejoId(e.target.value)}
          required
          disabled={!!defaultComplejoId && !initial}
        >
          <option value="">Seleccionar…</option>
          {complejos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Nombre *</span>
        <input
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Cancha 1"
          required
        />
      </label>

      <div className="form-row-2">
        <label className="field">
          <span className="field-label">Largo (m)</span>
          <input
            className="input"
            inputMode="decimal"
            value={largo}
            onChange={(e) => setLargo(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Ancho (m)</span>
          <input
            className="input"
            inputMode="decimal"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
          />
        </label>
      </div>

      <div className="form-row-2">
        <label className="field">
          <span className="field-label">Jugadores por equipo *</span>
          <input
            className="input"
            inputMode="numeric"
            value={jugadores}
            onChange={(e) => setJugadores(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Precio por hora (L) *</span>
          <input
            className="input"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
        </label>
      </div>

      {!hideActivoField ? (
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={activoInternal}
            onChange={(e) => setActivoInternal(e.target.checked)}
          />
          <span>Cancha activa</span>
        </label>
      ) : null}

      <div className="stack">
        <span className="field-label">Disponibilidad semanal</span>
        <div className="disp-grid">
          {DIAS_SEMANA.map((dia) => {
            const row = disp[dia.id];
            return (
              <div key={dia.id} className="disp-row">
                <label className="checkbox-field" style={{ minWidth: 100 }}>
                  <input
                    type="checkbox"
                    checked={row.activo}
                    onChange={(e) =>
                      setDisp((prev) => ({
                        ...prev,
                        [dia.id]: { ...prev[dia.id], activo: e.target.checked },
                      }))
                    }
                  />
                  <span>{dia.nombre}</span>
                </label>
                <input
                  type="time"
                  className="input"
                  value={row.hora_inicio}
                  disabled={!row.activo}
                  onChange={(e) =>
                    setDisp((prev) => ({
                      ...prev,
                      [dia.id]: { ...prev[dia.id], hora_inicio: e.target.value },
                    }))
                  }
                />
                <span className="muted">a</span>
                <input
                  type="time"
                  className="input"
                  value={row.hora_fin}
                  disabled={!row.activo}
                  onChange={(e) =>
                    setDisp((prev) => ({
                      ...prev,
                      [dia.id]: { ...prev[dia.id], hora_fin: e.target.value },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <PhotoGrid
        label="Fotos de la cancha"
        items={fotosExistentes.map((f) => ({ key: f.id, url: f.foto_url }))}
        pending={fotosPending.map((p) => ({ key: p.id, url: p.url, file: p.file }))}
        disabled={disabled || saving}
        onAdd={addFoto}
        onRemoveExisting={(key) =>
          setFotosExistentes((prev) => prev.filter((f) => f.id !== key))
        }
        onRemovePending={(key) =>
          setFotosPending((prev) => {
            const item = prev.find((p) => p.id === key);
            if (item) URL.revokeObjectURL(item.url);
            return prev.filter((p) => p.id !== key);
          })
        }
      />

      {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}

      <button type="submit" className="btn btn-primary" disabled={disabled || saving} style={{ maxWidth: 320 }}>
        {saving ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
