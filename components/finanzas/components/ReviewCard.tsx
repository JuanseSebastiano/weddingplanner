import { useState } from 'react';
import type { Account, CategorizationRule, Category, PendingExpense } from '@nf/shared';
import { useConfirmPending, useDiscardPending } from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTheme } from '../hooks/useTheme';
import { categoryColor } from '../lib/theme';
import { FormError } from './States';

interface Props {
  expense: PendingExpense;
  categories: Category[];
  accounts: Account[];
  rules: CategorizationRule[];
  onCreateRule?: (merchant: string, categoryId: string) => void;
}

/**
 * Cuánto resolvió el parser de este mail.
 *
 * No es un puntaje del modelo: se cuenta cuántos de los tres campos que el
 * parser intenta extraer —comercio, fecha y tarjeta— quedaron resueltos.
 * Sirve para ordenar la atención del usuario hacia lo que hay que mirar.
 */
function confidence(expense: PendingExpense): { label: string; tone: 'high' | 'mid' | 'low' } {
  const resolved = [
    Boolean(expense.merchant),
    Boolean(expense.ingestion?.received_at || expense.expense_date),
    Boolean(expense.account_id),
  ].filter(Boolean).length;

  if (resolved === 3) return { label: 'TODO RECONOCIDO', tone: 'high' };
  if (resolved === 2) return { label: 'REVISAR UN CAMPO', tone: 'mid' };
  return { label: 'REVISAR CON ATENCIÓN', tone: 'low' };
}

function receivedLabel(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `hoy ${time}`;
  return `${date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${time}`;
}

export function ReviewCard({ expense, categories, accounts, rules, onCreateRule }: Props) {
  const confirm = useConfirmPending();
  const discard = useDiscardPending();
  const { compact } = useBreakpoint();
  const { theme } = useTheme();

  const [amount, setAmount] = useState(() =>
    Number(expense.amount).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );
  const [expenseDate, setExpenseDate] = useState(expense.expense_date);
  const [categoryId, setCategoryId] = useState(expense.category_id ?? '');
  const [accountId, setAccountId] = useState(expense.account_id ?? '');
  const [merchant, setMerchant] = useState(expense.merchant ?? '');
  const [error, setError] = useState<string | null>(null);

  const busy = confirm.isPending || discard.isPending;
  const conf = confidence(expense);
  const appliedRule = rules.find((rule) => rule.id === expense.applied_rule_id);
  const categoryIndex = categories.findIndex((c) => c.id === categoryId);
  const swatch = categoryColor(
    categories.find((c) => c.id === categoryId)?.color ?? null,
    categoryIndex >= 0 ? categoryIndex : 0,
    theme,
  );

  async function handleConfirm() {
    setError(null);
    const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Revisá el monto antes de confirmar.');
      return;
    }

    try {
      await confirm.mutateAsync({
        id: expense.id,
        amount: parsedAmount,
        expense_date: expenseDate,
        category_id: categoryId || null,
        account_id: accountId || null,
        merchant: merchant.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos confirmar el gasto');
    }
  }

  return (
    <article
      className="pending-hatch grid animate-[nf-rise_340ms_cubic-bezier(0.22,1,0.36,1)_both] overflow-hidden rounded-[18px] border border-pending/[0.28] bg-card"
      style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'minmax(0,1.35fr) minmax(0,1fr)' }}
    >
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="chip border border-pending/30 bg-pending/[0.14] font-mono text-[10.5px] tracking-[0.08em] text-pending">
            PENDIENTE · {conf.label}
          </span>
          <span className="font-mono text-[10.5px] text-ink-faint">
            {receivedLabel(expense.ingestion?.received_at ?? null)}
          </span>
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))' }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-muted">Monto</span>
            <input
              className="tabular rounded-xl border border-dashed border-pending/40 bg-input px-3.5 py-3 text-right text-base font-semibold text-pending outline-none transition-colors focus:border-solid focus:border-accent focus:text-ink-strong focus:shadow-[0_0_0_3px_rgb(var(--nf-accent)/16%)]"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-muted">Comercio</span>
            <input
              className="rounded-xl border border-dashed border-pending/40 bg-input px-3.5 py-3 text-base text-ink-primary outline-none transition-colors focus:border-solid focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--nf-accent)/16%)]"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              placeholder="No reconocido"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-muted">Fecha</span>
            <input
              type="date"
              className="tabular rounded-xl border border-dashed border-pending/40 bg-input px-3.5 py-3 text-base text-ink-primary outline-none transition-colors focus:border-solid focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--nf-accent)/16%)]"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-muted">
              Rubro {appliedRule ? 'sugerido' : ''}
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-pending/40 bg-input pl-3.5 pr-2">
              <span
                className="h-2 w-2 shrink-0 rounded-[3px]"
                style={{ background: categoryId ? swatch : 'rgb(var(--nf-swatch-empty))' }}
                aria-hidden
              />
              <select
                className="flex-1 bg-transparent py-3 text-base text-ink-primary outline-none"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Sin rubro</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            {appliedRule && (
              <span className="font-mono text-[10px] text-ink-faint">
                REGLA · {appliedRule.name}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-muted">Tarjeta</span>
            <select
              className="rounded-xl border border-dashed border-pending/40 bg-input px-3.5 py-3 font-mono text-base text-ink-soft outline-none transition-colors focus:border-solid focus:border-accent"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Sin identificar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.last4 ? ` ··${account.last4}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <FormError message={error} />}

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className="btn-primary min-w-[150px] flex-1 py-3"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {confirm.isPending ? 'Confirmando…' : 'Confirmar e imputar'}
          </button>
          <button
            type="button"
            className="btn-danger py-3"
            onClick={() => discard.mutate(expense.id)}
            disabled={busy}
          >
            Descartar
          </button>
          {onCreateRule && merchant.trim() && categoryId && (
            <button
              type="button"
              className="btn-secondary py-3"
              onClick={() => onCreateRule(merchant.trim(), categoryId)}
            >
              Crear regla
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-l border-wash/[0.06] bg-well px-[22px] py-5">
        <span className="font-mono text-[10px] tracking-[0.1em] text-ink-faint">MAIL ORIGINAL</span>
        <span className="text-[12.5px] text-ink-secondary">
          {expense.ingestion?.subject ?? 'Sin asunto'}
        </span>
        <span className="truncate font-mono text-[11px] text-ink-faint">
          {expense.ingestion?.from_address ?? ''}
        </span>
        <pre className="m-0 max-h-[190px] overflow-auto whitespace-pre-wrap rounded-xl border border-wash/[0.05] bg-input p-3 font-mono text-[11.5px] leading-relaxed text-ink-muted">
          {expense.ingestion?.raw_snippet ?? 'El mail no dejó texto para mostrar.'}
        </pre>
        {expense.ingestion?.parser_id && (
          <span className="font-mono text-[10px] text-ink-faint">
            PARSER · {expense.ingestion.parser_id.toUpperCase()}
          </span>
        )}
      </div>
    </article>
  );
}
