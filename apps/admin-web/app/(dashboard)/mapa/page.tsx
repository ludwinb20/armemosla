'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader } from '@/components/Loader';
import { Modal } from '@/components/Modal';
import { createClient } from '@/lib/supabase/client';
import {
  ESTADO_COMERCIAL_COLORS,
  ESTADO_COMERCIAL_LABELS,
  actualizarProspecto,
  crearProspecto,
  crearProspectoCancha,
  eliminarProspecto,
  eliminarProspectoCancha,
  listarCanchasDeComplejo,
  listarComplejosParaVincular,
  listarProspectoCanchas,
  listarProspectos,
  type EstadoComercial,
  type ProspectoCancha,
  type ProspectoVenue,
} from '@armemosla/shared';

const CrmMap = dynamic(() => import('@/components/CrmMap').then((m) => m.CrmMap), {
  ssr: false,
});

const ESTADOS = Object.keys(ESTADO_COMERCIAL_LABELS) as EstadoComercial[];

type ComplejoOpt = { id: string; nombre: string; direccion_lat: number | null; direccion_lng: number | null };
type CanchaApp = { id: string; nombre: string; activo: boolean; jugadores_por_equipo: number | null; precio_por_hora: number | null };

export default function MapaPage() {
  const [prospectos, setProspectos] = useState<ProspectoVenue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [draftLatLng, setDraftLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const [complejos, setComplejos] = useState<ComplejoOpt[]>([]);
  const [canchasApp, setCanchasApp] = useState<CanchaApp[]>([]);
  const [canchasInv, setCanchasInv] = useState<ProspectoCancha[]>([]);
  const [newCanchaNombre, setNewCanchaNombre] = useState('');

  const [form, setForm] = useState({
    nombre: '',
    direccion_texto: '',
    estado_comercial: 'existente' as EstadoComercial,
    notas: '',
    contacto_nombre: '',
    contacto_telefono: '',
    complejo_id: '',
  });

  const selected = useMemo(
    () => prospectos.find((p) => p.id === selectedId) ?? null,
    [prospectos, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [list, comps] = await Promise.all([
        listarProspectos(supabase),
        listarComplejosParaVincular(supabase),
      ]);
      setProspectos(list);
      setComplejos(comps);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar CRM');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setCanchasApp([]);
      setCanchasInv([]);
      return;
    }
    setForm({
      nombre: selected.nombre,
      direccion_texto: selected.direccion_texto || '',
      estado_comercial: selected.estado_comercial,
      notas: selected.notas || '',
      contacto_nombre: selected.contacto_nombre || '',
      contacto_telefono: selected.contacto_telefono || '',
      complejo_id: selected.complejo_id || '',
    });

    const supabase = createClient();
    void (async () => {
      if (selected.complejo_id) {
        setCanchasApp(await listarCanchasDeComplejo(supabase, selected.complejo_id));
        setCanchasInv([]);
      } else {
        setCanchasApp([]);
        setCanchasInv(await listarProspectoCanchas(supabase, selected.id));
      }
    })();
  }, [selected]);

  function onMapClick(lat: number, lng: number) {
    setDraftLatLng({ lat, lng });
    setSelectedId(null);
    setForm({
      nombre: '',
      direccion_texto: '',
      estado_comercial: 'existente',
      notas: '',
      contacto_nombre: '',
      contacto_telefono: '',
      complejo_id: '',
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      if (selected) {
        const updated = await actualizarProspecto(supabase, selected.id, {
          nombre: form.nombre.trim(),
          direccion_texto: form.direccion_texto || null,
          estado_comercial: form.estado_comercial,
          notas: form.notas || null,
          contacto_nombre: form.contacto_nombre || null,
          contacto_telefono: form.contacto_telefono || null,
          complejo_id: form.complejo_id || null,
        });
        setProspectos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setSelectedId(updated.id);
      } else if (draftLatLng) {
        const created = await crearProspecto(supabase, {
          nombre: form.nombre.trim(),
          direccion_texto: form.direccion_texto || null,
          direccion_lat: draftLatLng.lat,
          direccion_lng: draftLatLng.lng,
          estado_comercial: form.estado_comercial,
          notas: form.notas || null,
          contacto_nombre: form.contacto_nombre || null,
          contacto_telefono: form.contacto_telefono || null,
          complejo_id: form.complejo_id || null,
        });
        setProspectos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setSelectedId(created.id);
        setDraftLatLng(null);
        setCreateMode(false);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selected) return;
    if (!window.confirm(`¿Eliminar "${selected.nombre}"?`)) return;
    try {
      await eliminarProspecto(createClient(), selected.id);
      setProspectos((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function onAddInventarioCancha() {
    if (!selected || selected.complejo_id || !newCanchaNombre.trim()) return;
    try {
      const row = await crearProspectoCancha(createClient(), selected.id, newCanchaNombre.trim());
      setCanchasInv((prev) => [...prev, row]);
      setNewCanchaNombre('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  async function onRemoveInventarioCancha(id: string) {
    try {
      await eliminarProspectoCancha(createClient(), id);
      setCanchasInv((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  function closePanel() {
    setSelectedId(null);
    setDraftLatLng(null);
  }

  const panelOpen = Boolean(selected || draftLatLng);
  const modalTitle = selected ? 'Editar venue' : 'Nuevo venue';

  return (
    <div className="map-page">
      <div className="map-page-toolbar stack" style={{ gap: '0.5rem' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Mapa CRM — San Pedro Sula
          </h1>
          <div className="row">
            <button
              type="button"
              className={`btn ${createMode ? 'btn-warning' : ''}`}
              onClick={() => {
                setCreateMode((v) => !v);
                closePanel();
              }}
            >
              {createMode ? 'Cancelar alta' : 'Registrar en mapa'}
            </button>
            <button type="button" className="btn" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        </div>

        <div className="legend" style={{ marginBottom: 0 }}>
          {ESTADOS.map((estado) => (
            <div key={estado} className="legend-item">
              <span
                className="legend-dot"
                style={{ background: ESTADO_COMERCIAL_COLORS[estado] }}
              />
              {ESTADO_COMERCIAL_LABELS[estado]}
            </div>
          ))}
        </div>

        {createMode ? (
          <p className="muted" style={{ margin: 0 }}>
            Hacé clic en el mapa para ubicar el venue.
          </p>
        ) : null}
        {loading ? <Loader inline /> : null}
        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
      </div>

      <div className="map-layout">
        <CrmMap
          prospectos={prospectos}
          selectedId={selectedId}
          onSelect={(id) => {
            setCreateMode(false);
            setDraftLatLng(null);
            setSelectedId(id);
          }}
          createMode={createMode}
          onMapClick={onMapClick}
        />
      </div>

      {panelOpen ? (
        <Modal title={modalTitle} onClose={closePanel}>
          <form className="stack" onSubmit={onSave}>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                required
              />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">Dirección</span>
              <input
                className="input"
                value={form.direccion_texto}
                onChange={(e) => setForm((f) => ({ ...f, direccion_texto: e.target.value }))}
              />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">Estado comercial</span>
              <select
                className="input"
                value={form.estado_comercial}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    estado_comercial: e.target.value as EstadoComercial,
                  }))
                }
                disabled={Boolean(form.complejo_id)}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_COMERCIAL_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">Vincular complejo en app</span>
              <select
                className="input"
                value={form.complejo_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    complejo_id: e.target.value,
                    estado_comercial: e.target.value ? 'en_app' : f.estado_comercial,
                  }))
                }
              >
                <option value="">— Sin vínculo —</option>
                {complejos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">Contacto</span>
              <input
                className="input"
                placeholder="Nombre"
                value={form.contacto_nombre}
                onChange={(e) => setForm((f) => ({ ...f, contacto_nombre: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Teléfono"
                value={form.contacto_telefono}
                onChange={(e) => setForm((f) => ({ ...f, contacto_telefono: e.target.value }))}
              />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">Notas</span>
              <textarea
                className="input"
                rows={3}
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              />
            </label>
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              {selected ? (
                <button type="button" className="btn btn-danger" onClick={() => void onDelete()}>
                  Eliminar
                </button>
              ) : null}
            </div>

            <hr style={{ borderColor: 'var(--border)', width: '100%' }} />

            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Canchas</h3>
            {selected?.complejo_id || form.complejo_id ? (
              canchasApp.length === 0 ? (
                <p className="muted">Sin canchas en el complejo vinculado.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {canchasApp.map((c) => (
                    <li key={c.id}>
                      {c.nombre}
                      <span className="muted">
                        {' '}
                        · {c.activo ? 'activa' : 'inactiva'}
                        {c.jugadores_por_equipo ? ` · ${c.jugadores_por_equipo}v${c.jugadores_por_equipo}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  Inventario (sin vínculo a la app)
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {canchasInv.map((c) => (
                    <li key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
                      <span>{c.nombre}</span>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '0.2rem 0.5rem' }}
                        onClick={() => void onRemoveInventarioCancha(c.id)}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
                {selected ? (
                  <div className="row">
                    <input
                      className="input"
                      placeholder="Nombre cancha"
                      value={newCanchaNombre}
                      onChange={(e) => setNewCanchaNombre(e.target.value)}
                    />
                    <button type="button" className="btn" onClick={() => void onAddInventarioCancha()}>
                      Agregar
                    </button>
                  </div>
                ) : (
                  <p className="muted">Guardá el venue para agregar canchas de inventario.</p>
                )}
              </>
            )}
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
