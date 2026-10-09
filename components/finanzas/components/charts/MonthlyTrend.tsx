import { formatCurrency, formatMonthLabel, type MonthlyPoint } from '@nf/shared';
import { COLORS, MEMBER_COLORS, MEMBER_SHAPES } from '../../lib/theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: MonthlyPoint[];
  members: Array<{ id: string; display_name: string }>;
  compact: boolean;
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function monthLabel(month: string, showYear: boolean): string {
  const index = Number(month.slice(5)) - 1;
  const abbr = MONTH_ABBR[index] ?? month.slice(5);
  return showYear ? `${abbr} ${month.slice(2, 4)}` : abbr;
}

/**
 * Tendencia de los últimos 12 meses, apilada por persona.
 *
 * Un solo eje —las dos series están en pesos y comparten escala— y el alto
 * de cada barra es su total sobre el máximo del período. En pantalla chica
 * se muestran los últimos 6 meses: con 12 las barras quedan tan finas que
 * la comparación deja de leerse.
 */
export function MonthlyTrend({ data, members, compact }: Props) {
  const visible = compact ? data.slice(-6) : data;
  const max = Math.max(...data.map((point) => point.total), 1);
  const peak = Math.max(...visible.map((point) => point.total));
  const hasData = data.some((point) => point.total > 0);

  const series = members.map((member, index) => ({
    ...member,
    color: MEMBER_COLORS[index % MEMBER_COLORS.length] as string,
    shape: MEMBER_SHAPES[index % MEMBER_SHAPES.length] as string,
  }));

  return (
    <ChartCard
      title="Tendencia 12 meses"
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
            {series.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-[7px] text-xs text-ink-secondary"
              >
                <span
                  className="h-[9px] w-[9px]"
                  style={{ background: member.color, borderRadius: member.shape }}
                  aria-hidden
                />
                {member.display_name}
              </span>
            ))}
          </div>

          <div className={`flex h-[190px] items-end ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
            {visible.map((point, index) => {
              const isLast = index === visible.length - 1;
              const isPeak = point.total === peak && peak > 0;
              const height = `${((point.total / max) * 100).toFixed(1)}%`;

              return (
                <div
                  key={point.month}
                  className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
                  title={`${formatMonthLabel(point.month)}: ${formatCurrency(point.total)}`}
                >
                  {/* Alto fijo: si la etiqueta ocupara espacio solo en algunas
                      columnas, flexbox comprimiría esas barras y la altura
                      dejaría de ser proporcional al monto. */}
                  <span
                    className="tabular h-[14px] shrink-0 text-[10px] leading-[14px]"
                    style={{ color: isPeak ? COLORS.pending : COLORS.textSecondary }}
                  >
                    {isLast || isPeak ? `$${Math.round(point.total / 1000)}k` : ''}
                  </span>

                  {/* Área de dibujo: la barra mide su porcentaje contra esto. */}
                  <div className="flex min-h-0 w-full flex-1 items-end">
                    <div
                      className="flex w-full animate-[nf-grow_620ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col overflow-hidden rounded-t-[7px] rounded-b-[3px]"
                      style={{
                        height,
                        transformOrigin: 'bottom',
                        animationDelay: `${index * 45}ms`,
                        opacity: isLast ? 1 : 0.78,
                      }}
                    >
                      {series.map((member) => {
                        const value = point.by_user[member.id] ?? 0;
                        const share = point.total > 0 ? (value / point.total) * 100 : 0;
                        if (share <= 0) return null;
                        return (
                          <div
                            key={member.id}
                            style={{ height: `${share}%`, background: member.color }}
                            title={`${member.display_name}: ${formatCurrency(value)}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <span
                    className="h-[14px] shrink-0 text-[10.5px] leading-[14px]"
                    style={{ color: isLast ? COLORS.textBright : COLORS.textFaint }}
                  >
                    {monthLabel(point.month, index === 0 || point.month.slice(5) === '01')}
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
