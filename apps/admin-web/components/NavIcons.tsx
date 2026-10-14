type IconProps = { className?: string };

const defaults = { className: 'nav-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IconDashboard({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IconBuilding({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <path d="M4 21V5a1 1 0 0 1 1-1h5v17" />
      <path d="M10 21V9h4v12" />
      <path d="M14 21V5a1 1 0 0 1 1-1h5v17" />
      <path d="M7 8h1M7 12h1M7 16h1M17 8h1M17 12h1M17 16h1" />
    </svg>
  );
}

export function IconField({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.2 3.1-5.5 7-5.5s7 2.3 7 5.5" />
      <path d="M16 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M22 20c0-2.2-1.8-4-4.2-4.7" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function IconPayments({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h3" />
    </svg>
  );
}

export function IconMap({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </svg>
  );
}

export function IconLogOut({ className }: IconProps) {
  return (
    <svg {...defaults} className={className ?? defaults.className} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
