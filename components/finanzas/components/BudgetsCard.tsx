import Link from 'next/link';
import { BUDGET_WARN_RATIO, formatCurrency, type BudgetState, type BudgetStatus } from '@nf/shared';
import { useTheme } from '../hooks/useTheme';
import { categoryColor } from '../lib/theme';
import { ChartCard } from './charts/ChartCard';

/** Cada estado tiene su color, su verbo y su texto de ayuda. */
const TONE: Record<BudgetState, { text: string; bar: string; border: string; chip: string }> = {
  ok: {
    text: 'text-ink-secondary',
    bar: 'rgb(var(--nf-accent))',
    border: 'border-wash/[0.06]',
    chip: 'text-ink-faint',
  },
  warning: {
    text: 'text-pending',
    bar: 'rgb(var(--nf-pending))',
    border: 'border-pending/[0.28]',
    chip: 'text-pending',
  },
  exceeded: {
    text: 'text-danger',
    bar: 'rgb(var(--nf-danger))',
    border: 'border-danger/[0.28]',
    chip: 'text-danger',
  },
};

const WARN_PCT = Math.round(BUDGET_WARN_RATIO * 100);

/**
 * El aviso propiamente dicho: una línea arriba del dashboard cuando algún
 * rubro se está acercando al tope o ya se pasó.
 *
 * Va antes que las tarjetas y no adentro de la de presupuestos porque el
 * punto es que se vea sin buscarlo — si hubiera que scrollear hasta la
 * tarjeta para enterarse, no sería un aviso.
 */
export function BudgetAlert({ budgets }: { budgets: BudgetStatus[] }) {
  const exceeded = budgets.filter((budget) => budget.state === 'exceeded');
  const warning = budgets.filter((budget) => budget.state === 'warning');
  if (exceeded.length === 0 && warning.length === 0) return null;

  // Si hay al menos uno pasado, el tono del cartel es el más grave.
  const critical = exceeded.length > 0;
  const tone = critical ? TONE.exceeded : TONE.warning;
  const names = (list: BudgetStatus[]) => list.map((budget) => budget.category_name).join(', ');

  return (
    <div
      className={`flex animate-[nf-rise_320ms_cubic-bezier(0.22,1,0.36,1)_both] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[15px] border px-4 py-3 ${tone.border}`}
      style={{
        background: critical
          ? 'rgb(var(--nf-danger)/8%)'
          : 'rgb(var(--nf-pending)/8%)',
      }}
      role="status"
    >
      <div className="flex min-w-0 flex-col gap-1">
        {exceeded.length > 0 && (
          <span className="text-[13px] text-danger [text-wrap:pretty]">
            <strong className="font-semibold">
              {exceeded.length === 1 ? 'Se pasó del tope' : `${exceeded.length} rubros se pasaron del tope`}
            </strong>
            : {names(exceeded)}.
          </span>
        )}
        {warning.length > 0 && (
          <span className="text-[13px] text-pending [text-wrap:pretty]">
            <strong className="font-semibold">
              {warning.length === 1 ? 'Cerca del tope' : `${warning.length} rubros cerca del tope`}
            </strong>
            : {names(warning)}.
          </span>
        )}
      </div>
      <Link
        href="/finanzas/gastos"
        className="shrink-0 text-[12px] text-ink-secondary underline underline-offset-2 hover:text-ink-primary"
      >
        Ver gastos
      </Link>
    </div>
  );
}

function BudgetRow({ budget, index }: { budget: BudgetStatus; index: number }) {
  const { theme } = useTheme();
  const tone = TONE[budget.state];
  // La barra se corta en 100 aunque el porcentaje siga: pasarse un 300%
  // no puede dibujar una barra tres veces más larga que la tarjeta.
  const filled = Math.min(100, budget.pct);
  const swatch = categoryColor(budget.color, index, theme);

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
            style={{ background: swatch }}
            aria-hidden
          />
          <span className="truncate text-[13px] text-ink-bright">{budget.category_name}</span>
        </span>
        <span className={`tabular shrink-0 text-[11.5px] ${tone.chip}`}>
          {budget.pct.toFixed(0)}%
        </span>
      </div>

      <div
        className="h-[7px] w-full overflow-hidden rounded-full bg-wash/[0.07]"
        role="progressbar"
        // `valuenow` va clampeado como la barra: un 135 contra un max de 100
        // es ARIA inválido. El porcentaje real, que es el dato que importa
        // cuando alguien se pasó, viaja en la etiqueta.
        aria-valuenow={Math.round(filled)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${budget.category_name}: ${budget.pct.toFixed(0)}% del tope`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${filled}%`, background: tone.bar }}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="tabular text-[11.5px] text-ink-secondary">
          {formatCurrency(budget.spent)} de {formatCurrency(budget.amount)}
        </span>
        <span className={`tabular text-[11.5px] ${tone.text}`}>
          {budget.remaining >= 0
            ? `Quedan ${formatCurrency(budget.remaining)}`
            : `${formatCurrency(Math.abs(budget.remaining))} de más`}
        </span>
      </div>
    </li>
  );
}

/**
 * Tarjeta con todos los topes del mes, del más consumido al menos.
 *
 * No se renderiza si el hogar no configuró ninguno: una tarjeta vacía
 * invitando a configurar algo ocuparía el mismo lugar que una con datos
 * en la pantalla más mirada de la app. El punto de entrada para crear el
 * primero está en Configuración.
 */
export function BudgetsCard({ budgets, compact }: { budgets: BudgetStatus[]; compact: boolean }) {
  if (budgets.length === 0) return null;

  return (
    <ChartCard
      title="Topes por rubro"
      meta={`AVISA AL ${WARN_PCT}% · ${budgets.length} ${budgets.length === 1 ? 'RUBRO' : 'RUBROS'}`}
      delay="200ms"
    >
      <ul
        className="m-0 grid list-none gap-x-7 gap-y-4 p-0"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))' }}
      >
        {budgets.map((budget, index) => (
          <BudgetRow key={budget.budget_id} budget={budget} index={index} />
        ))}
      </ul>
    </ChartCard>
  );
}
