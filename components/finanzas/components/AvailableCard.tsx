import Link from 'next/link';
import { formatCurrency, formatDate } from '@nf/shared';
import { useAvailable } from '../hooks/queries';

/**
 * Disponible real = líquido − deuda de tarjeta impaga. La tarjeta da un mes
 * de float: lo gastado ya no está disponible aunque todavía no se haya
 * debitado, así que se descuenta del saldo líquido.
 */
export function AvailableCard() {
  const { data, isLoading } = useAvailable();
  if (isLoading || !data) return null;

  if (data.totals.length === 0) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 px-[22px] py-4">
        <span className="text-[13px] text-ink-secondary">
          Cargá el saldo de tus cuentas y el cierre de tus tarjetas para ver el disponible real.
        </span>
        <Link href="/finanzas/configuracion" className="btn-secondary">
          Configurar cuentas
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 px-[22px] py-5">
      <span className="eyebrow">DISPONIBLE REAL</span>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {data.totals.map((row) => (
          <div key={row.currency} className="flex flex-col gap-1">
            <span
              className={`tabular font-serif text-[31px] font-normal ${
                row.available < 0 ? 'text-danger' : 'text-ink-strong'
              }`}
            >
              {formatCurrency(row.available, row.currency)}
            </span>
            <span className="text-xs text-ink-secondary">
              Líquido {formatCurrency(row.liquid, row.currency)} − tarjetas{' '}
              {formatCurrency(row.card_debt, row.currency)}
            </span>
          </div>
        ))}
      </div>
      {data.cards.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {data.cards.map((card) => (
            <li
              key={`${card.account_id}-${card.currency}`}
              className="flex items-center justify-between gap-3 text-[12.5px]"
            >
              <span className="min-w-0 truncate text-ink-soft">
                {card.name}
                <span className="text-ink-faint"> · impago desde {formatDate(card.unpaid_since)}</span>
              </span>
              <span className="tabular shrink-0 text-ink-primary">
                {formatCurrency(card.debt, card.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
