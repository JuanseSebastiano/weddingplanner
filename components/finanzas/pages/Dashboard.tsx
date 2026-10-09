'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  addMonths,
  currentMonth,
  formatCurrency,
  formatMonthLabel,
  type DashboardSummary,
} from '@nf/shared';
import { useDashboard } from '../hooks/queries';
import { AvailableCard } from '../components/AvailableCard';
import { CommitmentsCard } from '../components/CommitmentsCard';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { CategoryDonut } from '../components/charts/CategoryDonut';
import { UserSplit } from '../components/charts/UserSplit';
import { MonthlyTrend } from '../components/charts/MonthlyTrend';
import { BudgetAlert, BudgetsCard } from '../components/BudgetsCard';
import { CategoryExpensesFlyout } from '../components/CategoryExpensesFlyout';
import { EmptyState, ErrorState, Skeleton } from '../components/States';

/** Días transcurridos del mes, para el promedio diario. */
function elapsedDays(month: string): number {
  const now = new Date();
  const isCurrent = month === currentMonth(now);
  if (!isCurrent) {
    const [year, m] = month.split('-').map(Number);
    return new Date(Date.UTC(year ?? 2026, m ?? 1, 0)).getUTCDate();
  }
  return Math.max(1, now.getDate());
}

function HeroTotal({ data }: { data: DashboardSummary }) {
  const previous = data.previous_month_total;
  const delta = previous > 0 ? ((data.month_total - previous) / previous) * 100 : null;
  const up = delta !== null && delta > 0;

  return (
    <div
      className="relative flex animate-[nf-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col justify-center gap-3 overflow-hidden rounded-[18px] border border-accent/[0.22] px-6 py-[22px] shadow-hero"
      style={{
        background:
          'linear-gradient(160deg, rgb(var(--nf-accent)/12%), rgb(var(--nf-accent)/2%) 55%, rgb(var(--nf-card)))',
        gridColumn: 'var(--hero-span)',
        gridRow: 'var(--hero-rows)',
      }}
    >
      <span className="font-mono text-[10.5px] tracking-[0.12em] text-accent-soft">
        TOTAL DEL MES
      </span>
      <span className="tabular text-[40px] font-semibold leading-none tracking-[-0.03em]">
        {formatCurrency(data.month_total)}
      </span>
      <div className="flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-secondary">
        {delta !== null && (
          <span
            className={`tabular inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold ${
              up ? 'bg-pending/[0.12] text-pending' : 'bg-accent/[0.12] text-accent-soft'
            }`}
          >
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1).replace('.', ',')}%
          </span>
        )}
        <span>
          vs. {formatMonthLabel(addMonths(data.month, -1)).toLowerCase()} ·{' '}
          {formatCurrency(previous)}
        </span>
      </div>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'pending' | 'positive' | 'negative';
  delay: string;
  to?: string;
}

function Stat({ label, value, hint, tone = 'default', delay, to }: StatProps) {
  const border = {
    default: 'border-wash/[0.06]',
    pending: 'border-pending/[0.28]',
    positive: 'border-accent/[0.22]',
    negative: 'border-danger/[0.28]',
  }[tone];

  const text = {
    default: 'text-ink-strong',
    pending: 'text-pending',
    positive: 'text-accent',
    negative: 'text-danger',
  }[tone];

  const content = (
    <div
      className={`flex h-full animate-[nf-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col justify-between gap-3 rounded-[18px] border bg-card px-[22px] py-5 shadow-card ${border}`}
      style={{ animationDelay: delay }}
    >
      <span className="font-mono text-[10.5px] tracking-[0.12em] text-ink-faint">{label}</span>
      <span className={`tabular text-[27px] font-semibold tracking-[-0.02em] ${text}`}>{value}</span>
      <span className="text-xs leading-snug text-ink-secondary">{hint}</span>
    </div>
  );

  return to ? (
    <Link href={to} className="block transition-transform duration-150 hover:-translate-y-px">
      {content}
    </Link>
  ) : (
    content
  );
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const { compact } = useBreakpoint();
  const { data, isLoading, error, refetch } = useDashboard(month);

  const memberOrder = (data?.members ?? []).map((member) => member.id);
  const isEmpty = data && data.expense_count === 0 && data.pending_count === 0;

  // Tres tarjetas en una fila de cuatro columnas: el hero ocupa dos y las
  // otras dos una cada una. El hero necesita el doble de ancho porque un
  // total de siete cifras a 40px no entra en una sola columna.
  const gridStyle = {
    '--hero-span': compact ? 'auto' : 'span 2',
    '--hero-rows': 'auto',
  } as React.CSSProperties;

  return (
    <div className="flex flex-col gap-[18px]" style={gridStyle}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">DASHBOARD DEL HOGAR</span>
          <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">
            {formatMonthLabel(month)}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-0.5 rounded-[11px] border border-wash/[0.07] bg-well p-[3px]">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              className="h-[30px] w-8 rounded-lg text-[15px] text-ink-muted transition-colors hover:bg-wash/[0.06] hover:text-ink-primary"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <span className="px-2.5 font-mono text-xs text-ink-soft">{month}</span>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={month >= currentMonth()}
              className="h-[30px] w-8 rounded-lg text-[15px] text-ink-muted transition-colors hover:bg-wash/[0.06] hover:text-ink-primary disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          {(data?.pending_count ?? 0) > 0 && (
            <Link href="/finanzas/revision" className="btn-pending">
              Revisar {data?.pending_count} {data?.pending_count === 1 ? 'pendiente' : 'pendientes'}
            </Link>
          )}
        </div>
      </div>

      {data && <BudgetAlert budgets={data.budgets} />}

      {error && (
        <ErrorState
          source="ERROR · /api/dashboard"
          title="No pudimos traer el resumen del mes"
          description="Los gastos ya cargados están a salvo: esto es solo la lectura. Probá de nuevo en unos segundos o revisá la conexión."
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))' }}
          >
            {/* El primero reserva el hueco del hero: dos columnas de ancho. */}
            <Skeleton height={126} className={compact ? '' : 'col-span-2'} />
            <Skeleton height={126} />
            <Skeleton height={126} />
          </div>
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'minmax(0,1.55fr) minmax(0,1fr)' }}
          >
            <Skeleton height={290} />
            <Skeleton height={290} />
          </div>
          <Skeleton height={250} />
        </div>
      )}

      {data && isEmpty && (
        <EmptyState
          title={`${formatMonthLabel(month)} todavía no tiene gastos`}
          description="Cargá el primero a mano o esperá a que llegue el primer aviso de tarjeta al mail. En cuanto haya datos, acá aparece el resumen."
        >
          <Link href="/finanzas/gastos" className="btn-primary">
            Cargar un gasto
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            Ver {formatMonthLabel(addMonths(month, -1)).toLowerCase()}
          </button>
        </EmptyState>
      )}

      {data && !isEmpty && (
        <div className="flex flex-col gap-4">
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))' }}
          >
            <HeroTotal data={data} />
            <Stat
              label="PROMEDIO DIARIO"
              value={formatCurrency(Math.round(data.month_total / elapsedDays(month)))}
              hint={`Sobre ${elapsedDays(month)} días de ${formatMonthLabel(month).split(' ')[0]?.toLowerCase()}`}
              delay="60ms"
            />
            <Stat
              label="BALANCE DEL MES"
              value={formatCurrency(data.net)}
              hint={`Entraron ${formatCurrency(data.income_total)}`}
              tone={data.net < 0 ? 'negative' : 'positive'}
              delay="120ms"
              to="/finanzas/balance"
            />
          </div>

          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'minmax(0,1.55fr) minmax(0,1fr)' }}
          >
            <CategoryDonut
              data={data.by_category}
              total={data.month_total}
              compact={compact}
              onSelectCategory={(id, name) => setSelectedCategory({ id, name })}
            />
            <UserSplit data={data.by_user} memberOrder={memberOrder} month={data.month} />
          </div>

          <BudgetsCard budgets={data.budgets} compact={compact} />

          <MonthlyTrend data={data.trend} members={data.members} compact={compact} />
        </div>
      )}

      {/* Lo que viene (disponible y compromisos) va al final: arriba manda el mes. */}
      <AvailableCard />
      <CommitmentsCard />

      {selectedCategory && (
        <CategoryExpensesFlyout
          categoryId={selectedCategory.id}
          categoryName={selectedCategory.name}
          month={month}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}
