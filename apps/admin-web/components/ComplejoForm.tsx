'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ImageDropzone, PhotoGrid } from '@/components/ImageDropzone';
import { LocationMapPicker } from '@/components/LocationMapPicker';
import {
  listarAdminsCancha,
  type AdminCanchaOwner,
  type ComplejoWithFotos,
  type CreateComplejoInput,
} from '@armemosla/shared';

export interface ComplejoFormValues extends CreateComplejoInput {
  fotos_existentes: { id: string; foto_url: string }[];
  fotos_archivos: File[];
  logo_archivo: File | null;
  logo_removido: boolean;
}

interface Props {
  initial?: ComplejoWithFotos;
  activo?: boolean;
  hideActivoField?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (values: ComplejoFormValues) => Promise<void>;
}

export function ComplejoForm({
  initial,
  activo: activoProp,
  hideActivoField = false,
  submitLabel = 'Guardar',
  disabled = false,
  onSubmit,
}: Props) {
  const [owners, setOwners] = useState<AdminCanchaOwner[]>([]);
  const [adminId, setAdminId] = useState(initial?.admin_id ?? '');
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemovido, setLogoRemovido] = useState(false);
  const [direccionTexto, setDireccionTexto] = useState(initial?.direccion_texto ?? '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = initial?.direccion_lat;
    const lng = initial?.direccion_lng;
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  });
  const [activoInternal, setActivoInternal] = useState(initial?.activo ?? true);
  const [fotosExistentes, setFotosExistentes] = useState(
    initial?.fotos?.map((f) => ({ id: f.id, foto_url: f.foto_url })) ?? []
  );
  const [fotosPending, setFotosPending] = useState<{ id: string; file: File; url: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activo = activoProp ?? activoInternal;

  useEffect(() => {
    void listarAdminsCancha(createClient()).then(setOwners).catch(console.error);
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      for (const p of fotosPending) URL.revokeObjectURL(p.url);
    };
  }, [fotosPending]);

  const logoDisplayUrl = useMemo(() => {
    if (logoPreview) return logoPreview;
    if (logoRemovido) return null;
    return logoUrl || null;
  }, [logoPreview, logoRemovido, logoUrl]);

  function addFoto(file: File) {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFotosPending((prev) => [...prev, { id, file, url: URL.createObjectURL(file) }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!adminId) {
      setError('Seleccioná un dueño de cancha');
      return;
    }
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    if (!location) {
      setError('Marcá la ubicación del complejo en el mapa');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        admin_id: adminId,
        nombre,
        logo_url: logoRemovido ? null : logoUrl || null,
        logo_archivo: logoFile,
        logo_removido: logoRemovido,
        direccion_texto: direccionTexto || null,
        direccion_lat: location.lat,
        direccion_lng: location.lng,
        activo,
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
        <span className="field-label">Dueño de cancha *</span>
        <select
          className="input"
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          required
        >
          <option value="">Seleccionar…</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name?.trim() || o.email || o.id}
              {o.email && o.full_name ? ` (${o.email})` : ''}
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
          required
        />
      </label>

      <ImageDropzone
        label="Logo"
        aspect="logo"
        hint="JPG, PNG o WebP"
        imageUrl={logoDisplayUrl}
        disabled={disabled || saving}
        onFile={(file) => {
          setLogoFile(file);
          setLogoRemovido(false);
        }}
        onClear={() => {
          setLogoFile(null);
          setLogoUrl('');
          setLogoRemovido(true);
        }}
      />

      <label className="field">
        <span className="field-label">Dirección (texto)</span>
        <input
          className="input"
          value={direccionTexto}
          onChange={(e) => setDireccionTexto(e.target.value)}
          placeholder="Col. …, San Pedro Sula"
        />
      </label>

      <LocationMapPicker
        lat={location?.lat ?? null}
        lng={location?.lng ?? null}
        disabled={disabled || saving}
        onChange={(lat, lng) => setLocation({ lat, lng })}
      />

      {!hideActivoField ? (
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={activoInternal}
            onChange={(e) => setActivoInternal(e.target.checked)}
          />
          <span>Complejo activo (visible si no está oculto por mora)</span>
        </label>
      ) : null}

      <PhotoGrid
        label="Fotos del complejo"
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
