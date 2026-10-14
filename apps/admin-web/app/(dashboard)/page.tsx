'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import {
  ESTADO_COMERCIAL_LABELS,
  obtenerEstadisticasPlataforma,
  type EstadisticasPlataforma,
} from '@armemosla/shared';

function formatLempiras(amount: number): string {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatCard({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
}) {
  const body = (
    <div className={`stat-card stat-card--${accent ?? 'default'}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {hint ? <div className="stat-card-hint">{hint}</div> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="stat-card-link">
        {body}
      </Link>
    );
  }

  return body;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack">
      <h2 className="section-title">{title}</h2>
      <div className="stat-grid">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<EstadisticasPlataforma | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await obtenerEstadisticasPlataforma(createClient());
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Loader label="Cargando estadísticas…" />;
  }

  if (error) {
    return (
      <div className="stack">
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <p className="muted">
          Si el error menciona que la función no existe, ejecutá{' '}
          <code>db_settings/57_dashboard_plataforma.sql</code> en Supabase.
        </p>
        <button type="button" className="btn" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const crmEstados = Object.entries(stats.crm.por_estado).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className="stack dashboard">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Dashboard
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Resumen de la plataforma · actualizado{' '}
            {new Date(stats.generado_en).toLocaleString('es-HN')}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Actualizar
        </button>
      </div>

      <Section title="Entrada reciente">
        <StatCard
          label="Usuarios nuevos (7 días)"
          value={stats.usuarios.nuevos_7_dias}
          hint={`${stats.usuarios.nuevos_30_dias} en los últimos 30 días`}
        />
        <StatCard
          label="Reservas creadas (7 días)"
          value={stats.reservas.nuevas_7_dias}
          hint="Excluye canceladas"
        />
        <StatCard
          label="Reservas hoy"
          value={stats.reservas.hoy}
          hint="Calendario Honduras"
        />
        <StatCard
          label="Pendientes futuras"
          value={stats.reservas.pendientes_futuras}
        />
      </Section>

      <Section title="Usuarios e infraestructura">
        <StatCard label="Jugadores" value={stats.usuarios.jugadores} />
        <StatCard label="Admins de cancha" value={stats.usuarios.admins_cancha} />
        <StatCard
          label="Complejos en app"
          value={stats.infraestructura.complejos_visibles}
          hint={`${stats.infraestructura.complejos_ocultos} ocultos por mora`}
        />
        <StatCard
          label="Canchas activas"
          value={stats.infraestructura.canchas_activas}
          hint={`${stats.infraestructura.canchas_total} total`}
        />
      </Section>

      <Section title="Actividad del mes">
        <StatCard
          label="Reservas del mes"
          value={stats.reservas.mes_calendario}
        />
        <StatCard
          label="Completadas"
          value={stats.reservas.completadas_mes}
          accent="success"
        />
        <StatCard
          label="Volumen completadas"
          value={formatLempiras(stats.reservas.volumen_completadas_mes)}
          hint="Suma precio por hora"
        />
        <StatCard
          label="Comisión cobrada"
          value={formatLempiras(stats.pagos.comision_cobrada_mes)}
          accent="success"
        />
      </Section>

      <Section title="Operaciones pendientes">
        <StatCard
          label="Transferencias en revisión"
          value={stats.pagos.transferencias_pendientes}
          accent={stats.pagos.transferencias_pendientes > 0 ? 'warning' : 'default'}
          href="/pagos"
        />
        <StatCard
          label="Reembolsos solicitados"
          value={stats.pagos.reembolsos_pendientes}
          accent={stats.pagos.reembolsos_pendientes > 0 ? 'warning' : 'default'}
          href="/pagos"
        />
        <StatCard
          label="Facturas por cobrar"
          value={stats.pagos.facturas_pendientes}
          accent={stats.pagos.facturas_pendientes > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Comisión pendiente"
          value={formatLempiras(stats.pagos.comision_pendiente_total)}
          accent={stats.pagos.comision_pendiente_total > 0 ? 'danger' : 'default'}
        />
      </Section>

      <Section title="CRM · San Pedro Sula">
        <StatCard
          label="Prospectos"
          value={stats.crm.prospectos_total}
          href="/mapa"
        />
        {crmEstados.map(([estado, count]) => (
          <StatCard
            key={estado}
            label={ESTADO_COMERCIAL_LABELS[estado as keyof typeof ESTADO_COMERCIAL_LABELS] ?? estado}
            value={count ?? 0}
            href="/mapa"
          />
        ))}
      </Section>

      {/* <div className="row" style={{ marginTop: '0.5rem' }}>
        <Link className="btn btn-primary" href="/pagos">
          Ir a revisión de pagos
        </Link>
        <Link className="btn" href="/mapa">
          Abrir mapa CRM
        </Link>
      </div> */}
    </div>
  );
}
