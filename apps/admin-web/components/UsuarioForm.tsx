'use client';

import { useState } from 'react';
import {
  USER_TYPE_LABELS,
  type AppUserRole,
  type CreateUsuarioAdminInput,
  type UpdateUsuarioAdminInput,
  type UserProfile,
} from '@armemosla/shared';

const USER_TYPES: AppUserRole[] = ['Jugador', 'Administrador de Cancha'];

export type UsuarioFormValues =
  | ({ mode: 'create' } & CreateUsuarioAdminInput)
  | ({ mode: 'edit' } & UpdateUsuarioAdminInput);

interface Props {
  initial?: UserProfile;
  mode: 'create' | 'edit';
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (values: UsuarioFormValues) => Promise<void>;
}

export function UsuarioForm({
  initial,
  mode,
  submitLabel,
  disabled = false,
  onSubmit,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [userType, setUserType] = useState<AppUserRole>(
    initial?.user_type ?? 'Jugador'
  );
  const [esAdmin, setEsAdmin] = useState(initial?.es_admin_plataforma ?? false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'create') {
      if (!email.trim()) {
        setError('El email es obligatorio');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await onSubmit({
          mode: 'create',
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          user_type: userType,
          es_admin_plataforma: esAdmin,
        });
      } else {
        await onSubmit({
          mode: 'edit',
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          user_type: userType,
          es_admin_plataforma: esAdmin,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-card stack" onSubmit={(e) => void handleSubmit(e)}>
      {mode === 'edit' && initial ? (
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" value={initial.email ?? '—'} readOnly disabled />
        </label>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Email *</span>
            <input
              className="input"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Contraseña *</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
        </>
      )}

      <label className="field">
        <span className="field-label">Nombre completo</span>
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Teléfono</span>
        <input
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Tipo de usuario *</span>
        <select
          className="input"
          value={userType}
          onChange={(e) => setUserType(e.target.value as AppUserRole)}
          required
        >
          {USER_TYPES.map((t) => (
            <option key={t} value={t}>
              {USER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="field checkbox-field">
        <input
          type="checkbox"
          checked={esAdmin}
          onChange={(e) => setEsAdmin(e.target.checked)}
        />
        <span>Admin de plataforma (acceso a este panel)</span>
      </label>

      {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || saving}
        style={{ maxWidth: 320 }}
      >
        {saving ? 'Guardando…' : submitLabel ?? (mode === 'create' ? 'Crear usuario' : 'Guardar cambios')}
      </button>
    </form>
  );
}
