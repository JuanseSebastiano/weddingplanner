import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatDate, monthBounds } from '@nf/shared';
import { useExpenses } from '../hooks/queries';
import { EmptyState, ErrorState, Skeleton } from './States';

interface Props {
  /** `null` es la fila "Sin rubro" de la dona. */
  categoryId: string | null;
  categoryName: string;
  month: string;
  onClose: () => void;
}

/**
 * Pestaña flotante con el detalle de gastos de un rubro del mes, disparada
 * al tocar una fila del "Por rubro" del dashboard.
 *
 * El filtro `category_id` de `/api/expenses` no soporta `null`, así que para
 * "Sin rubro" se pide sin ese filtro y se recorta acá. `page_size: 200` evita
 * paginar dentro de la pestaña: un mes normal no llega a esa cantidad de
 * gastos confirmados por rubro.
 */
export function CategoryExpensesFlyout({ categoryId, categoryName, month, onClose }: Props) {
  const bounds = monthBounds(month);
  const expenses = useExpenses({
    from: bounds.start,
    to: bounds.end,
    category_id: categoryId ?? undefined,
    page_size: 200,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const items = (expenses.data?.items ?? []).filter((expense) =>
    categoryId === null ? expense.category_id === null : true,
  );
  const total = items.reduce((sum, expense) => sum + Number(expense.amount), 0);

  // Portal a <body>: la sidebar de escritorio es `position: sticky`, que
  // crea su propio stacking context y tapa un overlay `fixed` renderizado
  // dentro de <main> aunque tenga mayor z-index.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[480px] animate-[nf-rise_260ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-3.5 rounded-[18px] border border-wash/[0.09] bg-card p-5 shadow-hero"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Gastos de ${categoryName}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] tracking-[0.1em] text-ink-faint">
              {items.length} {items.length === 1 ? 'GASTO' : 'GASTOS'} · CONFIRMADOS
            </span>
            <h2 className="m-0 font-serif text-xl font-normal leading-tight">{categoryName}</h2>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-ink-muted transition-colors hover:bg-wash/[0.06] hover:text-ink-primary"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {expenses.error && (
          <ErrorState
            source="ERROR · /api/expenses"
            title="No pudimos cargar el detalle"
            onRetry={() => void expenses.refetch()}
          />
        )}

        {expenses.isLoading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((key) => (
              <Skeleton key={key} height={52} className="!rounded-xl" />
            ))}
          </div>
        )}

        {!expenses.isLoading && !expenses.error && items.length === 0 && (
          <EmptyState
            title="Sin gastos en este rubro"
            description="Este mes no hay gastos confirmados en esta categoría."
          />
        )}

        {items.length > 0 && (
          <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5">
            {items.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-wash/[0.04]"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] text-ink-primary">
                    {expense.merchant ?? '—'}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {formatDate(expense.expense_date)}
                    {expense.account ? ` · ${expense.account.name}` : ''}
                  </span>
                </div>
                <span className="tabular shrink-0 text-[13.5px] font-semibold text-ink-strong">
                  {formatCurrency(Number(expense.amount), expense.currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-wash/[0.07] pt-3">
            <span className="text-[10.5px] tracking-[0.1em] text-ink-faint">TOTAL</span>
            <span className="tabular text-[16px] font-semibold">{formatCurrency(total)}</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
