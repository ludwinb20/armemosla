'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import {
  USER_TYPE_LABELS,
  listarUsuariosAdmin,
  type AppUserRole,
  type UserProfile,
} from '@armemosla/shared';

type FiltroTipo = 'todos' | AppUserRole | 'sin_tipo';

function displayName(u: UserProfile): string {
  return u.full_name?.trim() || u.email || u.id.slice(0, 8);
}

export default function UsuariosPageClient() {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [tipo, setTipo] = useState<FiltroTipo>('todos');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filterArg = tipo === 'todos' ? undefined : tipo;
      const data = await listarUsuariosAdmin(createClient(), filterArg);
      setUsuarios(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => {
      return (
        displayName(u).toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [usuarios, filtro]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Usuarios
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Gestionar jugadores, dueños de cancha y admins de plataforma
          </p>
        </div>
        <Link className="btn btn-primary" href="/usuarios/nuevo" style={{ width: 'auto' }}>
          Nuevo usuario
        </Link>
      </div>

      <div className="row">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nombre, email o teléfono…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 200 }}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as FiltroTipo)}
        >
          <option value="todos">Todos los tipos</option>
          <option value="Jugador">Jugadores</option>
          <option value="Administrador de Cancha">Dueños de cancha</option>
          <option value="sin_tipo">Sin tipo asignado</option>
        </select>
        <button type="button" className="btn" onClick={() => void load()}>
          Actualizar
        </button>
      </div>

      {loading ? <Loader inline /> : null}
      {error ? (
        <div className="stack">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <p className="muted">
            Ejecutá <code>db_settings/61_admin_usuarios.sql</code> en Supabase y configurá{' '}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> para crear usuarios.
          </p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Teléfono</th>
                <th>Rol panel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No hay usuarios.
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{displayName(u)}</strong>
                      {u.email ? (
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          {u.email}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {u.user_type ? (
                        USER_TYPE_LABELS[u.user_type]
                      ) : (
                        <span className="badge badge-muted">Sin tipo</span>
                      )}
                    </td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      {u.es_admin_plataforma ? (
                        <span className="badge badge-success">Superadmin</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <Link className="btn" href={`/usuarios/${u.id}`} style={{ padding: '0.4rem 0.75rem' }}>
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
