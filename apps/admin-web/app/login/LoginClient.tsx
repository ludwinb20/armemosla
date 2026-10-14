'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { esAdminPlataforma } from '@armemosla/shared';
import { GoogleLogo } from '@/components/GoogleLogo';

function loginErrorMessage(code: string | null): string {
  if (code === 'not_admin') return 'Tu cuenta no es admin de plataforma.';
  if (code === 'oauth') return 'No se pudo completar el inicio con Google.';
  if (code === 'config') return 'Falta configuración de Supabase en el servidor.';
  return '';
}

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    setError(loginErrorMessage(params.get('error')));
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      const ok = await esAdminPlataforma(supabase);
      if (!ok) {
        await supabase.auth.signOut();
        setError('Tu cuenta no es admin de plataforma.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar con Google');
      setGoogleLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <div className="login-wrap">
      <div className="login-card stack">
        <img
          className="login-logo"
          src="/logo.png"
          alt="Armemosla"
          width={180}
          height={180}
        />

        <p className="login-subtitle">
          Inicia sesión con tu cuenta de admin para acceder al panel
        </p>

        {error ? <p style={{ color: 'var(--danger)', margin: 0, textAlign: 'center' }}>{error}</p> : null}

        <form className="stack" onSubmit={onSubmit}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="field-label">Correo electrónico</span>
            <input
              className="input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={busy}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="field-label">Contraseña</span>
            <input
              className="input"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {loading ? 'Entrando…' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="login-divider">
          <span>O</span>
        </div>

        <button
          type="button"
          className="btn btn-google"
          onClick={() => void onGoogle()}
          disabled={busy}
          aria-label="Continuar con Google"
        >
          <GoogleLogo size={20} />
          <span>{googleLoading ? 'Redirigiendo…' : 'Continuar con Google'}</span>
        </button>

        <p className="login-footnote">Al continuar, aceptas nuestros términos de servicio</p>
      </div>
    </div>
  );
}
