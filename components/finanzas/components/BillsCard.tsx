import Link from 'next/link';
import { currentMonth, formatCurrency, formatDate } from '@nf/shared';
import { useBills } from '../hooks/queries';

/** Recordatorio: pagos fijos del mes que todavía no se marcaron como pagados. */
export function BillsCard() {
  const { data } = useBills(currentMonth());
  const pending = (data ?? []).filter((b) => !b.paid);
  if (pending.length === 0) return null;

  const today = new Date().toLocaleDateString('en-CA');

  return (
    <Link href="/finanzas/pagos" className="card flex flex-col gap-3 px-[22px] py-5">
      <span className="eyebrow">PAGOS FIJOS PENDIENTES</span>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {pending.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-ink-primary">{b.name}</span>
              <span className={`text-[11px] ${b.due_date < today ? 'text-danger' : 'text-ink-faint'}`}>
                {b.owner} · vence {formatDate(b.due_date)}
              </span>
            </span>
            <span className="tabular shrink-0 text-ink-primary">
              {b.amount === null ? '—' : formatCurrency(b.amount, b.currency)}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
