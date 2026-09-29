import Link from 'next/link';
import { formatCurrency, formatDate, type Commitment } from '@nf/shared';
import { useCommitments } from '../hooks/queries';

const SOURCE_LABEL: Record<Commitment['source'], string> = {
  boda: 'BODA',
  viaje: 'VIAJE',
  tarjeta: 'TARJETA',
};

const VISIBLES = 8;

/**
 * Lo que viene: pagos pendientes de la boda, lo que falta pagar del viaje y
 * el próximo resumen de cada tarjeta. Los datos quedan en su módulo; esto
 * los lee de la vista fin_commitments.
 */
export function CommitmentsCard() {
  const { data } = useCommitments();
  if (!data) return null;

  const { alert, commitments, trip_budget } = data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {alert && (
        <Link
          href={alert.commitment.href}
          className="block rounded-[18px] border border-danger-strong/30 bg-danger-strong/[0.07] px-[22px] py-4 text-[13px] text-danger"
        >
          <strong>El disponible real no cubre el próximo pago de la boda.</strong> {alert.commitment.label}{' '}
          vence el {alert.commitment.due_date ? formatDate(alert.commitment.due_date) : '—'} por{' '}
          {formatCurrency(alert.commitment.amount, alert.commitment.currency)}; proyectado a esa fecha hay{' '}
          {formatCurrency(alert.projected_ars)} y hacen falta {formatCurrency(alert.needed_ars)}.
        </Link>
      )}

      {commitments.length > 0 && (
        <div className="card flex flex-col gap-3 px-[22px] py-5">
          <span className="eyebrow">COMPROMISOS FUTUROS</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {commitments.slice(0, VISIBLES).map((c) => (
              <li key={`${c.source}-${c.ref_id}-${c.currency}-${c.due_date}`}>
                <Link href={c.href} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-ink-primary">{c.label}</span>
                    <span
                      className={`font-mono text-[11px] ${c.due_date && c.due_date < today ? 'text-danger' : 'text-ink-faint'}`}
                    >
                      {SOURCE_LABEL[c.source]} · {c.due_date ? formatDate(c.due_date) : 'sin fecha'}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-ink-primary">
                    {formatCurrency(c.amount, c.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {commitments.length > VISIBLES && (
            <span className="text-xs text-ink-faint">y {commitments.length - VISIBLES} más</span>
          )}
        </div>
      )}

      {trip_budget.length > 0 && (
        <Link href="/viaje/reservas" className="card flex flex-col gap-2 px-[22px] py-5">
          <span className="eyebrow">PRESUPUESTO DEL VIAJE</span>
          {trip_budget.map((b) => (
            <div key={b.currency} className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
              <span className="tabular text-[20px] font-semibold text-ink-strong">
                {formatCurrency(b.total, b.currency)}
              </span>
              <span className="text-ink-secondary">
                pagado {formatCurrency(b.paid, b.currency)} · falta {formatCurrency(b.pending, b.currency)}
              </span>
            </div>
          ))}
        </Link>
      )}
    </>
  );
}
