'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IconChevronDown, IconLogOut } from '@/components/NavIcons';

interface Props {
  onSignOut: () => void;
}

export function UserMenu({ onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const initial = (email?.[0] ?? 'A').toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-menu-avatar" aria-hidden>
          {initial}
        </span>
        <span className="user-menu-label">{email ?? 'Admin'}</span>
        <IconChevronDown className="user-menu-chevron" />
      </button>

      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="user-menu-item user-menu-item--danger"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <IconLogOut className="user-menu-item-icon" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
