import { formatCurrency, formatMonthLabel, type CashflowPoint } from '@nf/shared';
import { COLORS } from '../../lib/theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: CashflowPoint[];
  compact: boolean;
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function monthLabel(month: string): string {
  const index = Number(month.slice(5)) - 1;
  return MONTH_ABBR[index] ?? month.slice(5);
}

/** "$ 1.234.567" -> "1,2M" para las etiquetas del eje. */
function short(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${Math.round(abs)}`;
}

/**
 * Ingresos contra egresos, mes a mes.
 *
 * Las dos barras van pegadas y comparten escala — el pico absoluto del
 * período, sea de ingreso o de egreso — así que la comparación entre
 * columnas y dentro de cada mes se lee sin tocar nada. Debajo de cada par
 * va el neto, que es el número que en realidad importa.
 */
export function CashflowTrend({ data, compact }: Props) {
  const visible = compact ? data.slice(-6) : data;
  const max = Math.max(...data.flatMap((point) => [point.income, point.expense]), 1);
  const hasData = data.some((point) => point.income > 0 || point.expense > 0);

  return (
    <ChartCard
      title="Ingresos vs. egresos"
      meta={`EJE ÚNICO · ARS · MÁXIMO ${formatCurrency(max)}`}
      delay="240ms"
      className="gap-5"
    >
      {!hasData ? (
        <p className="m-0 py-10 text-center text-sm text-ink-faint">
          Todavía no hay historial suficiente para dibujar la tendencia.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-[7px] text-xs text-ink-secondary">
              <span
                className="h-[9px] w-[9px] rounded-full"
                style={{ background: COLORS.accent }}
                aria-hidden
              />
              Ingresos
            </span>
            <span className="inline-flex items-center gap-[7px] text-xs text-ink-secondary">
              <span
                className="h-[9px] w-[9px] rounded-[2px]"
                style={{ background: COLORS.accentB }}
                aria-hidden
              />
              Egresos
            </span>
          </div>

          <div className={`flex h-[210px] items-end ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
            {visible.map((point, index) => {
              const isLast = index === visible.length - 1;
              const negative = point.net < 0;

              return (
                <div
                  key={point.month}
                  className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
                  title={`${formatMonthLabel(point.month)} · Ingresos ${formatCurrency(
                    point.income,
                  )} · Egresos ${formatCurrency(point.expense)} · Neto ${formatCurrency(point.net)}`}
                >
                  {/* Área de dibujo: las barras miden su porcentaje contra esto. */}
                  <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-[2px]">
                    <div
                      className="w-full animate-[nf-grow_620ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-t-[5px]"
                      style={{
                        height: `${((point.income / max) * 100).toFixed(1)}%`,
                        background: COLORS.accent,
                        transformOrigin: 'bottom',
                        animationDelay: `${index * 45}ms`,
                        opacity: isLast ? 1 : 0.78,
                      }}
                    />
                    <div
                      className="w-full animate-[nf-grow_620ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-t-[5px]"
                      style={{
                        height: `${((point.expense / max) * 100).toFixed(1)}%`,
                        background: COLORS.accentB,
                        transformOrigin: 'bottom',
                        animationDelay: `${index * 45 + 20}ms`,
                        opacity: isLast ? 1 : 0.78,
                      }}
                    />
                  </div>

                  {/* Altos fijos: si la etiqueta ocupara espacio solo en algunas
                      columnas, flexbox comprimiría esas barras y la altura
                      dejaría de ser proporcional al monto. */}
                  <span
                    className="tabular h-[14px] shrink-0 text-[10px] leading-[14px]"
                    style={{ color: negative ? COLORS.danger : COLORS.accent }}
                  >
                    {short(point.net)}
                  </span>
                  <span
                    className="h-[14px] shrink-0 text-[10.5px] leading-[14px]"
                    style={{ color: isLast ? COLORS.textBright : COLORS.textFaint }}
                  >
                    {monthLabel(point.month)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ChartCard>
  );
}
