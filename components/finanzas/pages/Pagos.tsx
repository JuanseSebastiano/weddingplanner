import { useState, type FormEvent } from 'react';
import { addMonths, currentMonth, formatCurrency, formatDate, formatMonthLabel, parseAmount, type BillOfMonth } from '@nf/shared';
import { useBills, useDeleteBill, useMarkBillPaid, useMe, useSaveBill } from '../hooks/queries';
import { FormError } from '../components/States';

function BillRow({ bill, month, today }: { bill: BillOfMonth; month: string; today: string }) {
  const save = useSaveBill();
  const mark = useMarkBillPaid();
  const remove = useDeleteBill();
  const [amount, setAmount] = useState(bill.amount === null ? '' : String(bill.amount).replace('.', ','));
  const overdue = !bill.paid && bill.due_date < today;

  function saveAmount() {
    const value = amount.trim() ? parseAmount(amount) : null;
    if (value === bill.amount || (value !== null && !(value > 0))) return;
    save.mutate({ id: bill.id, amount: value });
  }

  return (
    <li className="flex items-center gap-3 border-t border-wash/[0.08] py-2.5 text-[13px] first:border-0">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[rgb(var(--nf-accent))]"
        checked={bill.paid}
        disabled={mark.isPending}
        onChange={(e) => mark.mutate({ id: bill.id, month, paid: e.target.checked })}
        aria-label={`Marcar ${bill.name} como pagado`}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate ${bill.paid ? 'text-ink-faint line-through' : 'text-ink-primary'}`}>{bill.name}</span>
        <span className={`text-[11px] ${overdue ? 'text-danger' : 'text-ink-faint'}`}>
          {bill.owner} · vence {formatDate(bill.due_date)}
          {overdue ? ' · vencido' : ''}
        </span>
      </span>
      <input
        className="input tabular !w-28 !py-1.5 text-right"
        inputMode="decimal"
        placeholder="Monto"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={saveAmount}
      />
      <button
        type="button"
        className="shrink-0 text-[12px] text-ink-faint hover:text-danger"
        onClick={() => {
          if (confirm(`¿Borrar "${bill.name}"?`)) remove.mutate(bill.id);
        }}
      >
        Borrar
      </button>
    </li>
  );
}

function NewBill() {
  const me = useMe();
  const save = useSaveBill();
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const members = me.data?.members ?? [];
  const owner = userId || me.data?.user.id || '';

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      { name, user_id: owner, amount: amount.trim() ? parseAmount(amount) : null, due_day: Number(day) },
      {
        onSuccess: () => {
          setName('');
          setAmount('');
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-t border-wash/[0.08] pt-4">
      <input className="input min-w-[140px] flex-1" placeholder="Nuevo pago (ej. Internet)" value={name} onChange={(e) => setName(e.target.value)} required />
      <select className="input !w-28" value={owner} onChange={(e) => setUserId(e.target.value)}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <input className="input tabular !w-28 text-right" inputMode="decimal" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
        Día
        <input className="input tabular !w-16" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} required />
      </label>
      <button type="submit" className="btn-primary" disabled={save.isPending || !owner}>
        Agregar
      </button>
      {save.error && <FormError message={save.error.message} />}
    </form>
  );
}

/** Pagos que se repiten todos los meses, con el tilde de pagado del mes. */
export function PagosPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data } = useBills(month);
  const today = new Date().toLocaleDateString('en-CA');
  const bills = data ?? [];
  const pending = bills.filter((b) => !b.paid);
  const pendingTotal = pending.reduce((acc, b) => acc + (b.currency === 'ARS' ? (b.amount ?? 0) : 0), 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">TODOS LOS MESES</span>
        <h1 className="m-0 font-serif text-2xl font-normal lg:text-[28px]">Pagos fijos</h1>
      </div>

      <div className="card flex flex-col gap-3 px-[22px] py-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={() => setMonth(addMonths(month, -1))}>
            ‹
          </button>
          <span className="flex flex-col items-center">
            <span className="text-[15px] text-ink-primary">{formatMonthLabel(month)}</span>
            <span className="text-xs text-ink-faint">
              {pending.length === 0
                ? 'Todo pagado'
                : `Faltan ${pending.length}${pendingTotal > 0 ? ` · ${formatCurrency(pendingTotal)}` : ''}`}
            </span>
          </span>
          <button type="button" className="btn-secondary" onClick={() => setMonth(addMonths(month, 1))}>
            ›
          </button>
        </div>

        <ul className="m-0 flex list-none flex-col p-0">
          {bills.map((bill) => (
            <BillRow key={`${bill.id}-${month}`} bill={bill} month={month} today={today} />
          ))}
        </ul>
        {data && bills.length === 0 && <span className="text-[13px] text-ink-secondary">Todavía no hay pagos fijos.</span>}

        <NewBill />
      </div>
    </div>
  );
}
