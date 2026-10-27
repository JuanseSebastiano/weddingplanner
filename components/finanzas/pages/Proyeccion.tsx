import { formatCurrency, formatMonthLabel, type ProjectionMonth } from '@nf/shared';
import { useProjection } from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { CashflowTrend } from '../components/charts/CashflowTrend';

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const COLUMNAS: { key: keyof ProjectionMonth; label: string }[] = [
  { key: 'income', label: 'Ingresos' },
  { key: 'living', label: 'Gastos del mes' },
  { key: 'boda', label: 'Boda' },
  { key: 'viaje', label: 'Luna de miel' },
  { key: 'net', label: 'Neto' },
  { key: 'balance', label: 'Saldo' },
];

function colorDe(key: keyof ProjectionMonth, valor: number): string {
  if ((key === 'net' || key === 'balance') && valor < 0) return 'text-danger';
  if (key === 'balance') return 'font-semibold text-ink-strong';
  return 'text-ink-primary';
}

function Dato({ label, valor, nota }: { label: string; valor: number; nota?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className={`tabular text-[15px] font-semibold ${valor < 0 ? 'text-danger' : 'text-ink-primary'}`}>
        {formatCurrency(valor)}
      </span>
      {nota ? <span className="text-xs text-ink-faint">{nota}</span> : null}
    </div>
  );
}

/**
 * Cash flow proyectado: ingresos y gastos de vida estimados con el promedio
 * de los últimos meses cerrados, más los pagos de la boda y del viaje, mes
 * a mes hasta el último pago programado.
 */
export function ProyeccionPage() {
  const { compact } = useBreakpoint();
  const { data, isLoading } = useProjection();
  if (isLoading || !data) return null;

  const { months, sin_fecha } = data;
  const final = months[months.length - 1]?.balance ?? data.saldo_inicial;
  const base = data.base_months.map((m) => MONTH_ABBR[Number(m.slice(5)) - 1]).join(', ');
  const ultimo = formatMonthLabel(data.base_months[data.base_months.length - 1]).toLowerCase();
  const sinFecha = sin_fecha.boda + sin_fecha.viaje;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">PROYECCIÓN DE LA PAREJA</span>
        <h1 className="m-0 font-serif text-2xl font-normal lg:text-[28px]">Cash flow</h1>
      </div>

      <div className="card flex flex-col gap-4 px-[22px] py-5">
        <span className="eyebrow">RESUMEN</span>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-secondary">
            Saldo proyectado a {months.length ? formatMonthLabel(months[months.length - 1].month) : 'hoy'}
          </span>
          <span className={`tabular font-serif text-[32px] font-normal ${final < 0 ? 'text-danger' : 'text-ink-strong'}`}>
            {formatCurrency(final)}
          </span>
          {data.cotizacion ? (
            <span className="tabular text-xs text-ink-faint">≈ {formatCurrency(final / data.cotizacion, 'USD')}</span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-wash/[0.08] pt-4 sm:grid-cols-4">
          <Dato label="Ingreso mensual estimado" valor={data.income_avg} />
          <Dato label="Gasto mensual estimado" valor={data.expense_avg} />
          <Dato label="Ahorro mensual estimado" valor={data.income_avg - data.expense_avg} />
          <Dato label="Saldo inicial" valor={data.saldo_inicial} nota="Ahorro actual" />
        </div>
        <span className="text-xs text-ink-faint">
          Ingreso estimado con el de {ultimo}; gastos con el promedio de {base}. En pesos; los pagos en dólares se convierten con su
          cotización o la actual.
        </span>
      </div>

      <CashflowTrend
        compact={compact}
        data={months.map((m) => ({ month: m.month, income: m.income, expense: m.expense, net: m.net }))}
      />

      <div className="card flex flex-col gap-4 px-[22px] py-5">
        <span className="eyebrow">MES A MES</span>

        <table className="hidden w-full border-collapse text-[13px] sm:table">
          <thead>
            <tr className="text-left text-xs text-ink-secondary">
              <th className="pb-2 font-normal">Mes</th>
              {COLUMNAS.map((c) => (
                <th key={c.key} className="pb-2 text-right font-normal">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-wash/[0.08]">
                <td className="py-2 text-ink-primary">{formatMonthLabel(m.month)}</td>
                {COLUMNAS.map((c) => (
                  <td key={c.key} className={`tabular py-2 text-right ${colorDe(c.key, m[c.key] as number)}`}>
                    {formatCurrency(m[c.key] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:hidden">
          {months.map((m) => (
            <li key={m.month} className="flex flex-col gap-1.5 border-t border-wash/[0.08] pt-3 first:border-0 first:pt-0">
              <span className="text-xs font-semibold text-ink-secondary">{formatMonthLabel(m.month)}</span>
              {COLUMNAS.map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-ink-secondary">{c.label}</span>
                  <span className={`tabular ${colorDe(c.key, m[c.key] as number)}`}>
                    {formatCurrency(m[c.key] as number)}
                  </span>
                </div>
              ))}
            </li>
          ))}
        </ul>

        {sinFecha > 0 && (
          <span className="text-xs text-ink-faint">
            Sin fecha y fuera del saldo: boda {formatCurrency(sin_fecha.boda)} · luna de miel{' '}
            {formatCurrency(sin_fecha.viaje)}
          </span>
        )}
      </div>
    </div>
  );
}
