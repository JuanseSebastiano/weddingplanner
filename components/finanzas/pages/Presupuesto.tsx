import Link from 'next/link';
import { formatCurrency, formatDate, type Commitment } from '@nf/shared';
import { usePresupuesto } from '../hooks/queries';

const SOURCE_LABEL: Record<Commitment['source'], string> = {
  boda: 'BODA',
  viaje: 'VIAJE',
  tarjeta: 'TARJETA',
};

function mesDe(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const [y, m] = iso.split('-').map(Number);
  const texto = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Linea({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-ink-secondary">{label}</span>
      <span className="tabular text-ink-primary">{valor}</span>
    </div>
  );
}

/**
 * Presupuesto de la boda y del viaje, con todos los pagos programados que
 * faltan. Se carga en cada módulo (Boda → Pagos, Viaje → Gastos); acá se ve
 * junto.
 */
export function PresupuestoPage() {
  const { data, isLoading } = usePresupuesto();
  if (isLoading || !data) return null;

  const { boda, viaje, pagos, ahorro } = data;
  const cotizacion = boda?.cotizacion ?? ahorro.cotizacion;
  const aArs = (monto: number, moneda: 'ARS' | 'USD') => (moneda === 'USD' ? monto * (cotizacion ?? 0) : monto);
  const totalArs = (boda?.previsto.ars ?? 0) + viaje.reduce((acc, v) => acc + aArs(v.total, v.currency), 0);
  const faltaArs = totalArs - ahorro.total_ars;
  const enUsd = (ars: number) => (cotizacion ? ` ≈ ${formatCurrency(ars / cotizacion, 'USD')}` : '');
  const today = new Date().toISOString().slice(0, 10);
  const porMes = new Map<string, Commitment[]>();
  for (const p of pagos) {
    const key = mesDe(p.due_date);
    porMes.set(key, [...(porMes.get(key) ?? []), p]);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">PROYECTOS DE LA PAREJA</span>
        <h1 className="m-0 text-[26px] font-semibold text-ink-strong">Presupuesto</h1>
      </div>

      <div className="card flex flex-col gap-2 px-[22px] py-5">
        <span className="eyebrow">RESUMEN</span>
        <Linea label="Presupuesto total (boda + viaje)" valor={formatCurrency(totalArs) + enUsd(totalArs)} />
        <Linea label="Ahorrado" valor={formatCurrency(ahorro.total_ars) + enUsd(ahorro.total_ars)} />
        <Linea
          label={faltaArs > 0 ? 'Falta ahorrar' : 'Ahorro de más'}
          valor={formatCurrency(Math.abs(faltaArs)) + enUsd(Math.abs(faltaArs))}
        />
      </div>

      <div className="grid gap-[18px] sm:grid-cols-2">
        <Link href="/boda/presupuesto" className="card flex flex-col gap-2 px-[22px] py-5">
          <span className="eyebrow">BODA</span>
          {boda ? (
            <>
              <span className="tabular text-[22px] font-semibold text-ink-strong">
                {formatCurrency(boda.previsto.usd, 'USD')}
              </span>
              <span className="text-xs text-ink-faint">
                ≈ {formatCurrency(boda.previsto.ars)} · cotización {formatCurrency(boda.cotizacion)}
              </span>
              <Linea label="Pagado" valor={formatCurrency(boda.pagado.usd, 'USD')} />
              <Linea label="Falta pagar" valor={formatCurrency(boda.pendiente.usd, 'USD')} />
            </>
          ) : (
            <span className="text-[13px] text-ink-secondary">Todavía no hay presupuesto de la boda.</span>
          )}
        </Link>

        <Link href="/viaje/gastos" className="card flex flex-col gap-2 px-[22px] py-5">
          <span className="eyebrow">VIAJE</span>
          {viaje.length === 0 && (
            <span className="text-[13px] text-ink-secondary">Todavía no hay nada con precio en el viaje.</span>
          )}
          {viaje.map((v) => (
            <div key={v.currency} className="flex flex-col gap-2">
              <span className="tabular text-[22px] font-semibold text-ink-strong">
                {formatCurrency(v.total, v.currency)}
              </span>
              <Linea label="Pagado" valor={formatCurrency(v.paid, v.currency)} />
              <Linea label="Falta pagar" valor={formatCurrency(v.pending, v.currency)} />
            </div>
          ))}
        </Link>
      </div>

      <div className="card flex flex-col gap-4 px-[22px] py-5">
        <span className="eyebrow">PAGOS PROGRAMADOS</span>
        {pagos.length === 0 && <span className="text-[13px] text-ink-secondary">No hay pagos pendientes.</span>}
        {[...porMes.entries()].map(([mes, lista]) => (
          <div key={mes} className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink-secondary">{mes}</span>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lista.map((c) => (
                <li key={`${c.source}-${c.ref_id}`}>
                  <Link href={c.href} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-ink-primary">{c.label}</span>
                      <span
                        className={`font-mono text-[11px] ${c.due_date && c.due_date < today ? 'text-danger' : 'text-ink-faint'}`}
                      >
                        {SOURCE_LABEL[c.source]} · {c.due_date ? formatDate(c.due_date) : 'sin fecha'}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-ink-primary">{formatCurrency(c.amount, c.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
