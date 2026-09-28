import { useEffect, useState, type FormEvent } from 'react';
import type { Account, Category, IncomeWithRelations } from '@nf/shared';
import { useCreateIncome, useUpdateIncome } from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FormError } from './States';

interface Props {
  /** Solo rubros de ingreso: los de gasto no aplican acá. */
  categories: Category[];
  accounts: Account[];
  /** Si viene, el formulario edita en vez de crear. */
  income?: IncomeWithRelations | null;
  onDone?: () => void;
  onCancel?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function IncomeForm({ categories, accounts, income, onCancel, onDone }: Props) {
  const create = useCreateIncome();
  const update = useUpdateIncome();
  const { compact } = useBreakpoint();

  const [amount, setAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(today());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payer, setPayer] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(
      income
        ? Number(income.amount).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '',
    );
    setIncomeDate(income?.income_date ?? today());
    setCategoryId(income?.category_id ?? '');
    setAccountId(income?.account_id ?? '');
    setPayer(income?.payer ?? '');
    setDescription(income?.description ?? '');
    setError(null);
  }, [income]);

  const pending = create.isPending || update.isPending;

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
      income_date: incomeDate,
      category_id: categoryId || null,
      account_id: accountId || null,
      payer: payer.trim() || null,
      description: description.trim() || null,
    };

    try {
      if (income) await update.mutateAsync({ id: income.id, ...payload });
      else await create.mutateAsync(payload);

      if (!income) {
        setAmount('');
        setPayer('');
        setDescription('');
      }
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar el ingreso');
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
        <h2 className="m-0 text-[15px] font-semibold">
          {income ? 'Editar ingreso' : 'Nuevo ingreso'}
        </h2>
        <span className="font-mono text-[10.5px] text-ink-faint">
          {income ? `PATCH /api/incomes/${income.id.slice(0, 8)}` : 'POST /api/incomes'}
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
            placeholder="850.000,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Quién pagó</span>
          <input
            className="input"
            placeholder="Empleador, cliente, inquilino"
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Fecha</span>
          <input
            type="date"
            className="input tabular"
            value={incomeDate}
            onChange={(event) => setIncomeDate(event.target.value)}
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
            <option value="">Sin rubro</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Dónde entró</span>
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
            placeholder="Sueldo de julio"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      {error && <FormError message={error} />}

      <div className="flex flex-wrap justify-end gap-2.5">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : income ? 'Guardar cambios' : 'Guardar ingreso'}
        </button>
      </div>
    </form>
  );
}
