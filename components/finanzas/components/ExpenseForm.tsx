import { useEffect, useState, type FormEvent } from 'react';
import type { Account, Category, ExpenseWithRelations } from '@nf/shared';
import { useCreateExpense, useCreateSavingsDeposit, useUpdateExpense } from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FormError } from './States';

/**
 * Valor centinela del selector de rubro para "esto no es un gasto, es plata
 * que va a la caja de ahorro".
 *
 * No es un rubro de verdad guardado en `categories` a propósito: si lo
 * fuera, la transferencia terminaría siendo una fila en `expenses` y todas
 * las sumas de gastos de la app tendrían que acordarse de excluirla. Acá el
 * formulario decide contra qué endpoint escribe, y la plata nunca entra a
 * la tabla de gastos.
 */
const SAVINGS_OPTION = '__ahorros__';

interface Props {
  categories: Category[];
  accounts: Account[];
  /** Si viene, el formulario edita en vez de crear. */
  expense?: ExpenseWithRelations | null;
  onDone?: () => void;
  onCancel?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseForm({ categories, accounts, expense, onCancel, onDone }: Props) {
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const deposit = useCreateSavingsDeposit();
  const { compact } = useBreakpoint();

  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(today());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(
      expense
        ? Number(expense.amount).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '',
    );
    setExpenseDate(expense?.expense_date ?? today());
    setCategoryId(expense?.category_id ?? '');
    setAccountId(expense?.account_id ?? '');
    setMerchant(expense?.merchant ?? '');
    setDescription(expense?.description ?? '');
    setError(null);
  }, [expense]);

  // Editar un gasto ya cargado no puede convertirlo en transferencia: son
  // tablas distintas. Para eso se borra el gasto y se carga la transferencia.
  const toSavings = !expense && categoryId === SAVINGS_OPTION;
  const pending = create.isPending || update.isPending || deposit.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresá un monto mayor a cero.');
      return;
    }

    const payload = {
      amount: parsedAmount,
      expense_date: expenseDate,
      category_id: categoryId || null,
      account_id: accountId || null,
      merchant: merchant.trim() || null,
      description: description.trim() || null,
    };

    try {
      if (toSavings) {
        // Sin comercio: una transferencia a la propia caja de ahorro no le
        // paga a nadie.
        await deposit.mutateAsync({
          amount: parsedAmount,
          moved_at: expenseDate,
          account_id: accountId || null,
          description: description.trim() || null,
        });
      } else if (expense) {
        await update.mutateAsync({ id: expense.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }

      if (!expense) {
        setAmount('');
        setMerchant('');
        setDescription('');
      }
      onDone?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : toSavings
            ? 'No pudimos guardar la transferencia'
            : 'No pudimos guardar el gasto',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex animate-[nf-rise_300ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-4 rounded-[18px] border border-accent/[0.22] px-6 py-[22px]"
      style={{
        background:
          'linear-gradient(180deg, rgb(var(--nf-accent)/6%), rgb(var(--nf-card)) 60%)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">
          {expense ? 'Editar gasto' : toSavings ? 'Nueva transferencia a ahorros' : 'Nuevo gasto manual'}
        </h2>
        <span className="text-[10.5px] text-ink-faint">
          {expense
            ? `PATCH /api/expenses/${expense.id.slice(0, 8)}`
            : toSavings
              ? 'POST /api/savings/deposits'
              : 'POST /api/expenses'}
        </span>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))' }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Monto (ARS)</span>
          <input
            className="input tabular text-right text-base font-semibold"
            inputMode="decimal"
            placeholder="24.380,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        {!toSavings && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-ink-muted">Comercio</span>
            <input
              className="input"
              placeholder="Coto Belgrano"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Fecha</span>
          <input
            type="date"
            className="input tabular"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Rubro</span>
          <select
            className="input"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Automático (según reglas)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            {!expense && (
              <optgroup label="No es un gasto">
                <option value={SAVINGS_OPTION}>Ahorros (transferencia)</option>
              </optgroup>
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">
            {toSavings ? 'Sale de' : 'Tarjeta'}
          </span>
          <select
            className="input"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Sin especificar</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.last4 ? ` ··${account.last4}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Descripción (opcional)</span>
          <input
            className="input"
            placeholder="Compra semanal"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      {toSavings && (
        <p className="m-0 rounded-xl border border-accent/20 bg-accent/[0.07] px-3 py-2 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
          Esto <strong className="font-semibold text-ink-primary">no suma al total de gastos</strong>{' '}
          del mes: guardar no es gastar, la plata cambia de lugar y sigue siendo tuya. Entra a{' '}
          <strong className="font-semibold text-ink-primary">Ahorros</strong> como efectivo en pesos
          y desde ahí la asignás a la inversión que quieras.
        </p>
      )}

      {error && <FormError message={error} />}

      <div className="flex flex-wrap justify-end gap-2.5">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending
            ? 'Guardando…'
            : expense
              ? 'Guardar cambios'
              : toSavings
                ? 'Guardar transferencia'
                : 'Guardar gasto'}
        </button>
      </div>
    </form>
  );
}
