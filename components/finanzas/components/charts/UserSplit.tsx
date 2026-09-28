import { formatCurrency, formatMonthLabel, type UserTotal } from '@nf/shared';
import { MEMBER_COLORS, MEMBER_SHAPES } from '../../lib/theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: UserTotal[];
  /** Orden estable de miembros: el color sigue a la persona, no al ranking. */
  memberOrder: string[];
  month: string;
}

/**
 * Cuánto puso cada uno este mes.
 *
 * Barras horizontales en vez de un gráfico de barras: con dos series la
 * comparación es directa y el monto puede ir como etiqueta, sin leyenda
 * aparte ni tooltip.
 */
export function UserSplit({ data, memberOrder, month }: Props) {
  const total = data.reduce((sum, entry) => sum + entry.total, 0);
  const indexOf = (userId: string) => {
    const index = memberOrder.indexOf(userId);
    return index >= 0 ? index : memberOrder.length;
  };

  const rows = data.map((entry) => {
    const index = indexOf(entry.user_id);
    return {
      ...entry,
      color: MEMBER_COLORS[index % MEMBER_COLORS.length] as string,
      shape: MEMBER_SHAPES[index % MEMBER_SHAPES.length] as string,
      share: total > 0 ? (entry.total / total) * 100 : 0,
    };
  });

  const gap = rows.length === 2 ? Math.abs((rows[0]?.total ?? 0) - (rows[1]?.total ?? 0)) : null;

  return (
    <ChartCard title="Entre nosotros" meta={formatMonthLabel(month).toUpperCase()} delay="180ms">
      <div className="flex flex-col gap-5">
        {rows.map((row) => (
          <div key={row.user_id} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="inline-flex items-center gap-2 text-[13.5px] text-ink-bright">
                <span
                  className="h-[9px] w-[9px]"
                  style={{ background: row.color, borderRadius: row.shape }}
                  aria-hidden
                />
                {row.display_name}
              </span>
              <span className="tabular text-base font-semibold">{formatCurrency(row.total)}</span>
            </div>

            <div className="h-[9px] overflow-hidden rounded-full bg-wash/[0.05]">
              <div
                className="h-full animate-[nf-fade_520ms_ease_both] rounded-full"
                style={{
                  width: `${row.share}%`,
                  background: row.color,
                  animationDelay: '260ms',
                }}
              />
            </div>

            <div className="flex justify-between font-mono text-[11px] text-ink-secondary">
              <span>
                {row.count} {row.count === 1 ? 'gasto' : 'gastos'}
              </span>
              <span>{row.share.toFixed(0)}% del hogar</span>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="m-0 py-6 text-center text-sm text-ink-faint">
            Sin gastos confirmados este mes.
          </p>
        )}
      </div>

      {gap !== null && (
        <div className="mt-auto flex items-baseline justify-between border-t border-wash/[0.06] pt-3.5">
          <span className="text-[12.5px] text-ink-muted">Diferencia</span>
          <span className="tabular text-sm font-semibold text-ink-soft">{formatCurrency(gap)}</span>
        </div>
      )}
    </ChartCard>
  );
}
