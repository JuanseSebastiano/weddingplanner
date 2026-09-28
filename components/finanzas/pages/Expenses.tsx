'use client';

import { useState } from 'react';
import {
  addMonths,
  currentMonth,
  formatCurrency,
  formatDate,
  monthBounds,
  type Category,
  type ExpenseFilters,
  type ExpenseWithRelations,
} from '@nf/shared';
import {
  useAccounts,
  useCategoriesByKind,
  useDeleteExpense,
  useExpenses,
  useMe,
} from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTheme } from '../hooks/useTheme';
import { categoryColor, type Theme } from '../lib/theme';
import { ExpenseForm } from '../components/ExpenseForm';
import { EmptyState, ErrorState, Skeleton } from '../components/States';

const PAGE_SIZE = 25;

function defaultFilters(): ExpenseFilters {
  // Arranca mostrando los últimos tres meses.
  const { start } = monthBounds(addMonths(currentMonth(), -2));
  const { end } = monthBounds(currentMonth());
  return { from: start, to: end, page: 1, page_size: PAGE_SIZE };
}

/** Índice del rubro en el catálogo: define el nivel de luminosidad. */
function colorFor(
  categories: Category[],
  categoryId: string | null,
  hex: string | null,
  theme: Theme,
): string {
  const index = categoryId ? categories.findIndex((c) => c.id === categoryId) : -1;
  return categoryColor(hex, index >= 0 ? index : 0, theme);
}

export function ExpensesPage() {
  const [filters, setFilters] = useState<ExpenseFilters>(defaultFilters);
  const [editing, setEditing] = useState<ExpenseWithRelations | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { compact, cards } = useBreakpoint();
  const { theme } = useTheme();
  const categories = useCategoriesByKind('expense');
  const accounts = useAccounts();
  const me = useMe();
  const expenses = useExpenses(filters);
  const remove = useDeleteExpense();

  const update = (patch: Partial<ExpenseFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));

  const items = expenses.data?.items ?? [];
  const total = expenses.data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / (filters.page_size ?? PAGE_SIZE)));
  const catalog = categories.data ?? [];

  const tableCols = compact
    ? '1fr'
    : '92px minmax(0,1.4fr) minmax(140px,1fr) 128px 96px 130px';

  const activeChips: Array<{ label: string; clear: () => void }> = [];
  if (filters.from || filters.to) {
    activeChips.push({
      label: `${filters.from ?? '…'} → ${filters.to ?? '…'}`,
      clear: () => update({ from: undefined, to: undefined }),
    });
  }
  if (filters.user_id) {
    const member = me.data?.members.find((m) => m.id === filters.user_id);
    activeChips.push({
      label: member?.display_name ?? 'persona',
      clear: () => update({ user_id: undefined }),
    });
  }
  if (filters.category_id) {
    const category = catalog.find((c) => c.id === filters.category_id);
    activeChips.push({
      label: category?.name ?? 'rubro',
      clear: () => update({ category_id: undefined }),
    });
  }
  if (filters.account_id) {
    const account = accounts.data?.find((a) => a.id === filters.account_id);
    activeChips.push({
      label: account?.name ?? 'tarjeta',
      clear: () => update({ account_id: undefined }),
    });
  }
  if (filters.search) {
    activeChips.push({ label: `"${filters.search}"`, clear: () => update({ search: undefined }) });
  }

  const rows = items.map((expense, index) => {
    const isPending = expense.status === 'pending';
    return {
      expense,
      isPending,
      color: colorFor(catalog, expense.category_id, expense.category?.color ?? null, theme),
      delay: `${Math.min(index, 12) * 35}ms`,
    };
  });

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">
            {total} {total === 1 ? 'GASTO' : 'GASTOS'} · CON LOS FILTROS ACTUALES
          </span>
          <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Gastos</h1>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm((previous) => !previous);
          }}
        >
          {showForm && !editing ? 'Cerrar formulario' : 'Nuevo gasto'}
        </button>
      </div>

      {(showForm || editing) && (
        <ExpenseForm
          categories={catalog}
          accounts={accounts.data ?? []}
          expense={editing}
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

      <div className="card-sunken flex flex-col gap-3 px-[18px] py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            className="input min-w-[200px] flex-1"
            placeholder="Buscar comercio o descripción…"
            value={filters.search ?? ''}
            onChange={(event) => update({ search: event.target.value || undefined })}
          />

          <select
            className="input w-auto min-w-[130px]"
            value={filters.user_id ?? ''}
            onChange={(event) => update({ user_id: event.target.value || undefined })}
          >
            <option value="">Quién: todos</option>
            {(me.data?.members ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>

          <select
            className="input w-auto min-w-[130px]"
            value={filters.category_id ?? ''}
            onChange={(event) => update({ category_id: event.target.value || undefined })}
          >
            <option value="">Rubro: todos</option>
            {catalog.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="input w-auto min-w-[130px]"
            value={filters.account_id ?? ''}
            onChange={(event) => update({ account_id: event.target.value || undefined })}
          >
            <option value="">Tarjeta: todas</option>
            {(accounts.data ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="input w-auto"
            value={filters.from ?? ''}
            onChange={(event) => update({ from: event.target.value || undefined })}
            aria-label="Desde"
          />
          <input
            type="date"
            className="input w-auto"
            value={filters.to ?? ''}
            onChange={(event) => update({ to: event.target.value || undefined })}
            aria-label="Hasta"
          />
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] tracking-[0.08em] text-ink-faint">ACTIVOS</span>
            {activeChips.map((chip) => (
              <span
                key={chip.label}
                className="chip border border-accent/[0.28] bg-accent/10 text-accent-soft"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.clear}
                  className="text-accent-deep hover:text-accent"
                  aria-label={`Quitar filtro ${chip.label}`}
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              type="button"
              className="text-[11.5px] text-ink-muted underline hover:text-ink-primary"
              onClick={() => setFilters(defaultFilters())}
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {expenses.error && (
        <ErrorState
          source="ERROR · /api/expenses"
          title="No se pudo cargar la lista"
          onRetry={() => void expenses.refetch()}
        />
      )}

      {expenses.isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((key) => (
            <Skeleton key={key} height={56} className="!rounded-xl" />
          ))}
        </div>
      )}

      {!expenses.isLoading && !expenses.error && items.length === 0 && (
        <EmptyState
          title="Ningún gasto coincide con los filtros"
          description="Probá ampliar el rango de fechas o quitar el filtro de rubro."
        >
          <button type="button" className="btn-secondary" onClick={() => setFilters(defaultFilters())}>
            Limpiar filtros
          </button>
        </EmptyState>
      )}

      {items.length > 0 && !cards && (
        <div className="overflow-hidden rounded-[18px] border border-wash/[0.06] bg-card shadow-card">
          <div
            className="grid gap-3 border-b border-wash/[0.06] bg-sunken px-5 py-3 font-mono text-[10.5px] tracking-[0.08em] text-ink-faint"
            style={{ gridTemplateColumns: tableCols }}
          >
            <span>FECHA</span>
            <span>COMERCIO</span>
            <span>RUBRO</span>
            <span>TARJETA</span>
            <span>QUIÉN</span>
            <span className="text-right">MONTO</span>
          </div>

          {rows.map(({ expense, isPending, color, delay }) => (
            <div
              key={expense.id}
              className={`grid animate-[nf-rise_320ms_ease_both] items-center gap-3 border-b border-wash/[0.04] px-5 py-3 transition-colors last:border-0 hover:bg-wash/[0.035] ${
                isPending ? 'pending-hatch' : ''
              }`}
              style={{
                gridTemplateColumns: tableCols,
                animationDelay: delay,
                borderLeft: `3px solid ${isPending ? 'rgb(var(--nf-pending))' : 'transparent'}`,
              }}
            >
              <span className="tabular font-mono text-xs text-ink-muted">
                {formatDate(expense.expense_date)}
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] text-ink-primary">
                  {expense.merchant ?? '—'}
                </span>
                <span className="truncate text-[11.5px] text-ink-faint">
                  {isPending ? 'Propuesta del parser · sin confirmar' : expense.description ?? ''}
                </span>
              </span>

              <span className="inline-flex min-w-0 items-center gap-[7px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-[3px]"
                  style={{ background: expense.category ? color : 'rgb(var(--nf-swatch-empty))' }}
                  aria-hidden
                />
                <span className="truncate text-[12.5px] text-ink-soft">
                  {expense.category?.name ?? 'Sin rubro'}
                </span>
              </span>

              <span className="truncate font-mono text-xs text-ink-muted">
                {expense.account ? `${expense.account.name}` : '—'}
              </span>

              <span className="truncate text-[12.5px] text-ink-soft">
                {expense.profile?.display_name ?? '—'}
              </span>

              <span className="flex flex-col items-end gap-0.5">
                <span
                  className={`tabular text-sm font-semibold ${
                    isPending ? 'text-pending' : 'text-ink-strong'
                  }`}
                >
                  {formatCurrency(Number(expense.amount), expense.currency)}
                </span>
                {isPending ? (
                  <span className="font-mono text-[9.5px] tracking-[0.06em] text-pending">
                    NO SUMA
                  </span>
                ) : (
                  expense.user_id === me.data?.user.id && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        className="text-[10.5px] text-ink-faint underline hover:text-accent-soft"
                        onClick={() => {
                          setEditing(expense);
                          setShowForm(false);
                        }}
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        className="text-[10.5px] text-ink-faint underline hover:text-danger"
                        onClick={() => {
                          if (confirm('¿Borrar este gasto?')) remove.mutate(expense.id);
                        }}
                      >
                        borrar
                      </button>
                    </span>
                  )
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && cards && (
        <div className="flex flex-col gap-2.5">
          {rows.map(({ expense, isPending, color, delay }) => (
            <div
              key={expense.id}
              className={`flex animate-[nf-rise_320ms_ease_both] flex-col gap-2.5 rounded-[15px] border border-wash/[0.06] px-4 py-3.5 ${
                isPending ? 'pending-hatch bg-card' : 'bg-card'
              }`}
              style={{
                animationDelay: delay,
                borderLeft: `3px solid ${
                  isPending ? 'rgb(var(--nf-pending))' : 'rgb(var(--nf-wash)/6%)'
                }`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[14.5px] font-medium">
                    {expense.merchant ?? '—'}
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-secondary">
                    {formatDate(expense.expense_date)}
                    {expense.account ? ` · ${expense.account.name}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    className={`tabular text-[17px] font-semibold ${
                      isPending ? 'text-pending' : 'text-ink-strong'
                    }`}
                  >
                    {formatCurrency(Number(expense.amount), expense.currency)}
                  </span>
                  {isPending && (
                    <span className="font-mono text-[9.5px] text-pending">NO SUMA</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-wash/[0.05] text-[11.5px]" style={{ color }}>
                  <span
                    className="h-[7px] w-[7px] rounded-[2px]"
                    style={{ background: expense.category ? color : 'rgb(var(--nf-swatch-empty))' }}
                    aria-hidden
                  />
                  {expense.category?.name ?? 'Sin rubro'}
                </span>
                <span className="chip bg-wash/[0.05] text-[11.5px] text-ink-secondary">
                  {expense.profile?.display_name ?? '—'}
                </span>
                {expense.user_id === me.data?.user.id && !isPending && (
                  <span className="ml-auto flex gap-3">
                    <button
                      type="button"
                      className="text-[11.5px] text-ink-faint underline hover:text-accent-soft"
                      onClick={() => {
                        setEditing(expense);
                        setShowForm(false);
                      }}
                    >
                      editar
                    </button>
                    <button
                      type="button"
                      className="text-[11.5px] text-ink-faint underline hover:text-danger"
                      onClick={() => {
                        if (confirm('¿Borrar este gasto?')) remove.mutate(expense.id);
                      }}
                    >
                      borrar
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-sunken px-5 py-3.5">
          <span className="font-mono text-[11px] text-ink-faint">
            {(page - 1) * (filters.page_size ?? PAGE_SIZE) + 1}–
            {Math.min(page * (filters.page_size ?? PAGE_SIZE), total)} DE {total}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="rounded-[9px] border border-wash/[0.09] bg-card px-3 py-1.5 text-xs text-ink-soft disabled:cursor-not-allowed disabled:text-ink-faint"
              disabled={page <= 1}
              onClick={() => setFilters((previous) => ({ ...previous, page: page - 1 }))}
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
              onClick={() => setFilters((previous) => ({ ...previous, page: page + 1 }))}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
