import { formatCurrency, formatDate } from '@nf/shared';
import { useCardStatements } from '../hooks/queries';

/** Últimos resúmenes de tarjeta leídos del mail: totales en pesos y en dólares. */
export function StatementsCard() {
  const { data } = useCardStatements();
  if (!data || data.statements.length === 0) return null;

  const today = new Date().toLocaleDateString('en-CA');

  return (
    <div className="card flex flex-col gap-3 px-[22px] py-5">
      <span className="eyebrow">RESÚMENES DE TARJETA</span>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-secondary">Total en pesos</span>
          <span className="tabular font-serif text-[26px] text-ink-strong">{formatCurrency(data.total_ars)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-secondary">Total en dólares</span>
          <span className="tabular font-serif text-[26px] text-ink-strong">{formatCurrency(data.total_usd, 'USD')}</span>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 border-t border-wash/[0.08] p-0 pt-3">
        {data.statements.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-ink-primary">{s.card}</span>
              <span className={`text-[11px] ${s.due_date && s.due_date < today ? 'text-ink-faint line-through' : 'text-ink-faint'}`}>
                {[s.owner?.display_name, s.due_date ? `vence ${formatDate(s.due_date)}` : null, s.min_payment ? `mínimo ${formatCurrency(s.min_payment)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="tabular flex shrink-0 flex-col items-end text-ink-primary">
              <span>{formatCurrency(s.total_ars ?? 0)}</span>
              {s.total_usd ? <span className="text-[12px] text-ink-secondary">{formatCurrency(s.total_usd, 'USD')}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
