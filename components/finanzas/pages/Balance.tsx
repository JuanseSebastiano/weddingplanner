'use client';

import { useState } from 'react';
import {
  addMonths,
  currentMonth,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  monthBounds,
  type IncomeWithRelations,
  type LedgerFilters,
  type LedgerKind,
} from '@nf/shared';
import {
  useAccounts,
  useCashflow,
  useCategories,
  useCategoriesByKind,
  useDeleteIncome,
  useIncomes,
  useLedger,
  useMe,
} from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTheme } from '../hooks/useTheme';
import { categoryColor } from '../lib/theme';
import { IncomeForm } from '../components/IncomeForm';
import { CashflowTrend } from '../components/charts/CashflowTrend';
import { EmptyState, ErrorState, Skeleton } from '../components/States';

const PAGE_SIZE = 25;

/**
 * Resumen de ingresos contra egresos del mes, más el listado cronológico
 * de los dos juntos.
 *
 * El alta de ingresos vive acá y no en una pantalla aparte: filtrando por
 * "Solo ingresos" el listado ya es el registro de ingresos, y separarlo
 * obligaría a saltar entre dos vistas para entender un mismo mes.
 */
export function BalancePage() {
  const [month, setMonth] = useState(currentMonth());
  const [kind, setKind] = useState<LedgerKind | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IncomeWithRelations | null>(null);

  const { compact, cards } = useBreakpoint();
  const { theme } = useTheme();
  const me = useMe();
  const accounts = useAccounts();
  const categories = useCategories();
  const incomeCategories = useCategoriesByKind('income');
  const cashflow = useCashflow(month);
  const removeIncome = useDeleteIncome();

  const { start, end } = monthBounds(month);
  const filters: LedgerFilters = {
    from: start,
    to: end,
    ...(kind ? { kind } : {}),
    page,
    page_size: PAGE_SIZE,
  };
  const ledger = useLedger(filters);

  // Se piden los ingresos del mes aparte para poder editarlos: la fila del
  // listado unificado es una proyección y no trae los campos del formulario.
  const monthIncomes = useIncomes({ from: start, to: end, page_size: 200 });

  const summary = cashflow.data;
  const entries = ledger.data?.items ?? [];
  const total = ledger.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const catalog = categories.data ?? [];

  const changeMonth = (delta: number) => {
    setMonth(addMonths(month, delta));
    setPage(1);
  };

  const colorFor = (categoryId: string | null, hex: string | null) => {
    const index = categoryId ? catalog.findIndex((c) => c.id === categoryId) : -1;
    return categoryColor(hex, index >= 0 ? index : 0, theme);
  };

  const tableCols = '92px 96px minmax(0,1.5fr) minmax(130px,1fr) 100px 140px';

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">INGRESOS Y EGRESOS</span>
          <h1 className="m-0 font-serif text-2xl font-normal lg:text-[28px]">
            {formatMonthLabel(month)}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-0.5 rounded-[11px] border border-wash/[0.07] bg-well p-[3px]">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="h-[30px] w-8 rounded-lg text-[15px] text-ink-muted transition-colors hover:bg-wash/[0.06] hover:text-ink-primary"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <span className="px-2.5 text-xs text-ink-soft">{month}</span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={month >= currentMonth()}
              className="h-[30px] w-8 rounded-lg text-[15px] text-ink-muted transition-colors hover:bg-wash/[0.06] hover:text-ink-primary disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setShowForm((previous) => !previous);
            }}
          >
            {showForm && !editing ? 'Cerrar formulario' : 'Nuevo ingreso'}
          </button>
        </div>
      </div>

      {(showForm || editing) && (
        <IncomeForm
          categories={incomeCategories.data ?? []}
          accounts={accounts.data ?? []}
          income={editing}
          onDone={() => {
            setEditing(null);
            setShowForm(false);
          }}
          onCancel={() => {
            setEditing(null);
            setShowForm(false);
          }}
        />
      )}

      {cashflow.error && (
        <ErrorState
          source="ERROR · /api/cashflow"
          title="No pudimos traer el balance del mes"
          description="Los movimientos ya cargados están a salvo: esto es solo la lectura."
          onRetry={() => void cashflow.refetch()}
        />
      )}

      {cashflow.isLoading && (
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))' }}
        >
          <Skeleton height={126} />
          <Skeleton height={126} />
          <Skeleton height={126} />
          <Skeleton height={126} />
        </div>
      )}

      {summary && (
        <>
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))' }}
          >
            <FlowStat
              label="INGRESOS"
              value={formatCurrency(summary.income_total)}
              hint={`${summary.income_count} ${summary.income_count === 1 ? 'movimiento' : 'movimientos'}`}
              tone="income"
              delay="0ms"
            />
            <FlowStat
              label="EGRESOS"
              value={formatCurrency(summary.expense_total)}
              hint={`${summary.expense_count} ${summary.expense_count === 1 ? 'movimiento' : 'movimientos'} · solo confirmados`}
              tone="expense"
              delay="60ms"
            />
            <FlowStat
              label="BALANCE DEL MES"
              value={formatCurrency(summary.net)}
              // Lo apartado para ahorrar no está descontado del neto: guardar
              // no es gastar. El neto dice cuánto sobró y esto, cuánto de eso
              // ya se guardó.
              hint={
                summary.savings_total > 0
                  ? `${formatCurrency(summary.savings_total)} ya fueron a ahorros`
                  : `Mes anterior: ${formatCurrency(summary.previous_net)}`
              }
              tone={summary.net < 0 ? 'negative' : 'income'}
              delay="120ms"
            />
            <FlowStat
              label="TASA DE AHORRO"
              value={
                summary.savings_rate === null
                  ? '—'
                  : `${summary.savings_rate.toFixed(1).replace('.', ',')}%`
              }
              hint={
                summary.savings_rate === null
                  ? 'Sin ingresos cargados este mes'
                  : 'Del ingreso que no se gastó'
              }
              tone={summary.savings_rate !== null && summary.savings_rate < 0 ? 'negative' : 'neutral'}
              delay="180ms"
            />
          </div>

          <CashflowTrend data={summary.trend} compact={compact} />
        </>
      )}

      {/* --- Listado unificado ------------------------------------------ */}
      <div className="card-sunken flex flex-wrap items-center gap-2.5 px-[18px] py-4">
        <div className="flex items-center gap-0.5 rounded-[11px] border border-wash/[0.07] bg-well p-[3px]">
          {(
            [
              ['', 'Todo'],
              ['income', 'Ingresos'],
              ['expense', 'Egresos'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setKind(value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                kind === value
                  ? 'bg-accent/[0.16] text-accent'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
          {total} {total === 1 ? 'MOVIMIENTO' : 'MOVIMIENTOS'}
        </span>
      </div>

      {ledger.error && (
        <ErrorState
          source="ERROR · /api/cashflow/ledger"
          title="No se pudo cargar el listado"
          onRetry={() => void ledger.refetch()}
        />
      )}

      {ledger.isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} height={56} className="!rounded-xl" />
          ))}
        </div>
      )}

      {!ledger.isLoading && !ledger.error && entries.length === 0 && (
        <EmptyState
          title={`${formatMonthLabel(month)} no tiene movimientos`}
          description="Cargá un ingreso acá o un gasto desde la pantalla Gastos. En cuanto haya datos, este listado los muestra juntos y ordenados por fecha."
        />
      )}

      {entries.length > 0 && !cards && (
        <div className="overflow-hidden rounded-[18px] border border-wash/[0.06] bg-card shadow-card">
          <div
            className="grid gap-3 border-b border-wash/[0.06] bg-sunken px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint"
            style={{ gridTemplateColumns: tableCols }}
          >
            <span>FECHA</span>
            <span>TIPO</span>
            <span>DETALLE</span>
            <span>RUBRO</span>
            <span>QUIÉN</span>
            <span className="text-right">MONTO</span>
          </div>

          {entries.map((entry, index) => {
            const income = entry.kind === 'income';
            const color = colorFor(entry.category?.id ?? null, entry.category?.color ?? null);
            return (
              <div
                key={`${entry.kind}-${entry.id}`}
                className="grid animate-[nf-rise_320ms_ease_both] items-center gap-3 border-b border-wash/[0.04] px-5 py-3 transition-colors last:border-0 hover:bg-wash/[0.035]"
                style={{
                  gridTemplateColumns: tableCols,
                  animationDelay: `${Math.min(index, 12) * 35}ms`,
                  borderLeft: `3px solid ${
                    income ? 'rgb(var(--nf-accent))' : 'rgb(var(--nf-violet))'
                  }`,
                }}
              >
                <span className="tabular text-xs text-ink-muted">
                  {formatDate(entry.date)}
                </span>

                <span
                  className={`chip w-fit text-[10.5px] font-medium ${
                    income
                      ? 'border border-accent/[0.28] bg-accent/10 text-accent-soft'
                      : 'border border-violet/[0.28] bg-violet/10 text-violet'
                  }`}
                >
                  {income ? 'Ingreso' : 'Egreso'}
                </span>

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] text-ink-primary">
                    {entry.counterparty ?? '—'}
                  </span>
                  <span className="truncate text-[11.5px] text-ink-faint">
                    {entry.description ?? ''}
                  </span>
                </span>

                <span className="inline-flex min-w-0 items-center gap-[7px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[3px]"
                    style={{
                      background: entry.category ? color : 'rgb(var(--nf-swatch-empty))',
                    }}
                    aria-hidden
                  />
                  <span className="truncate text-[12.5px] text-ink-soft">
                    {entry.category?.name ?? 'Sin rubro'}
                  </span>
                </span>

                <span className="truncate text-[12.5px] text-ink-soft">
                  {entry.profile?.display_name ?? '—'}
                </span>

                <span className="flex flex-col items-end gap-0.5">
                  <span
                    className={`tabular text-sm font-semibold ${
                      income ? 'text-accent' : 'text-ink-strong'
                    }`}
                  >
                    {income ? '+' : '−'} {formatCurrency(entry.amount, entry.currency)}
                  </span>
                  {income && entry.profile?.id === me.data?.user.id && (
                    <IncomeActions
                      entryId={entry.id}
                      incomes={monthIncomes.data?.items ?? []}
                      onEdit={(found) => {
                        setEditing(found);
                        setShowForm(false);
                      }}
                      onDelete={(id) => removeIncome.mutate(id)}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {entries.length > 0 && cards && (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry, index) => {
            const income = entry.kind === 'income';
            const color = colorFor(entry.category?.id ?? null, entry.category?.color ?? null);
            return (
              <div
                key={`${entry.kind}-${entry.id}`}
                className="flex animate-[nf-rise_320ms_ease_both] flex-col gap-2.5 rounded-[15px] border border-wash/[0.06] bg-card px-4 py-3.5"
                style={{
                  animationDelay: `${Math.min(index, 12) * 35}ms`,
                  borderLeft: `3px solid ${
                    income ? 'rgb(var(--nf-accent))' : 'rgb(var(--nf-violet))'
                  }`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-medium">
                      {entry.counterparty ?? '—'}
                    </span>
                    <span className="text-[11.5px] text-ink-secondary">
                      {formatDate(entry.date)}
                    </span>
                  </div>
                  <span
                    className={`tabular shrink-0 text-[17px] font-semibold ${
                      income ? 'text-accent' : 'text-ink-strong'
                    }`}
                  >
                    {income ? '+' : '−'} {formatCurrency(entry.amount, entry.currency)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`chip text-[11.5px] ${
                      income
                        ? 'border border-accent/[0.28] bg-accent/10 text-accent-soft'
                        : 'border border-violet/[0.28] bg-violet/10 text-violet'
                    }`}
                  >
                    {income ? 'Ingreso' : 'Egreso'}
                  </span>
                  <span className="chip bg-wash/[0.05] text-[11.5px]" style={{ color }}>
                    <span
                      className="h-[7px] w-[7px] rounded-[2px]"
                      style={{
                        background: entry.category ? color : 'rgb(var(--nf-swatch-empty))',
                      }}
                      aria-hidden
                    />
                    {entry.category?.name ?? 'Sin rubro'}
                  </span>
                  <span className="chip bg-wash/[0.05] text-[11.5px] text-ink-secondary">
                    {entry.profile?.display_name ?? '—'}
                  </span>
                  {income && entry.profile?.id === me.data?.user.id && (
                    <span className="ml-auto">
                      <IncomeActions
                        entryId={entry.id}
                        incomes={monthIncomes.data?.items ?? []}
                        onEdit={(found) => {
                          setEditing(found);
                          setShowForm(false);
                        }}
                        onDelete={(id) => removeIncome.mutate(id)}
                      />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-sunken px-5 py-3.5">
          <span className="text-[11px] text-ink-faint">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} DE {total}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="rounded-[9px] border border-wash/[0.09] bg-card px-3 py-1.5 text-xs text-ink-soft disabled:cursor-not-allowed disabled:text-ink-faint"
              disabled={page <= 1}
              onClick={() => setPage((previous) => previous - 1)}
            >
              ‹
            </button>
            <span className="rounded-[9px] border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent-soft">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className="rounded-[9px] border border-wash/[0.09] bg-card px-3 py-1.5 text-xs text-ink-soft disabled:cursor-not-allowed disabled:text-ink-faint"
              disabled={page >= pageCount}
              onClick={() => setPage((previous) => previous + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Editar y borrar un ingreso desde la fila del listado unificado. */
function IncomeActions({
  entryId,
  incomes,
  onEdit,
  onDelete,
}: {
  entryId: string;
  incomes: IncomeWithRelations[];
  onEdit: (income: IncomeWithRelations) => void;
  onDelete: (id: string) => void;
}) {
  const found = incomes.find((income) => income.id === entryId);
  if (!found) return null;

  return (
    <span className="flex gap-2">
      <button
        type="button"
        className="text-[10.5px] text-ink-faint underline hover:text-accent-soft"
        onClick={() => onEdit(found)}
      >
        editar
      </button>
      <button
        type="button"
        className="text-[10.5px] text-ink-faint underline hover:text-danger"
        onClick={() => {
          if (confirm('¿Borrar este ingreso?')) onDelete(found.id);
        }}
      >
        borrar
      </button>
    </span>
  );
}

interface FlowStatProps {
  label: string;
  value: string;
  hint: string;
  tone: 'income' | 'expense' | 'negative' | 'neutral';
  delay: string;
}

function FlowStat({ label, value, hint, tone, delay }: FlowStatProps) {
  const border = {
    income: 'border-accent/[0.22]',
    expense: 'border-violet/[0.22]',
    negative: 'border-danger/[0.28]',
    neutral: 'border-wash/[0.06]',
  }[tone];

  const text = {
    income: 'text-accent',
    expense: 'text-ink-strong',
    negative: 'text-danger',
    neutral: 'text-ink-strong',
  }[tone];

  return (
    <div
      className={`flex h-full animate-[nf-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col justify-between gap-3 rounded-[18px] border bg-card px-[22px] py-5 shadow-card ${border}`}
      style={{ animationDelay: delay }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">{label}</span>
      <span className={`tabular font-serif text-[29px] font-normal ${text}`}>{value}</span>
      <span className="text-xs leading-snug text-ink-secondary">{hint}</span>
    </div>
  );
}
