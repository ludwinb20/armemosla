'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserMenu } from '@/components/UserMenu';
import {
  IconBuilding,
  IconCalendar,
  IconDashboard,
  IconField,
  IconMap,
  IconPayments,
  IconUsers,
} from '@/components/NavIcons';

const NAV = [
  { href: '/', label: 'Dashboard', match: 'exact' as const, Icon: IconDashboard },
  { href: '/complejos', label: 'Complejos', match: 'prefix' as const, Icon: IconBuilding },
  { href: '/canchas', label: 'Canchas', match: 'prefix' as const, Icon: IconField },
  { href: '/usuarios', label: 'Usuarios', match: 'prefix' as const, Icon: IconUsers },
  { href: '/reservas', label: 'Reservas', match: 'prefix' as const, Icon: IconCalendar },
  { href: '/pagos', label: 'Revisión de pagos', match: 'exact' as const, Icon: IconPayments },
  { href: '/mapa', label: 'Mapa CRM', match: 'prefix' as const, Icon: IconMap },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icono.png" alt="" width={32} height={32} />
          <span>Armemosla</span>
        </div>

        <nav className="sidebar-nav" aria-label="Principal">
          {NAV.map(({ href, label, match, Icon }) => {
            const active =
              match === 'prefix'
                ? pathname === href || pathname.startsWith(`${href}/`)
                : pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={`nav-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <UserMenu onSignOut={() => void signOut()} />
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
