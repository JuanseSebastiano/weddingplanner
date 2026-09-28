import { formatCurrency, type CategoryTotal } from '@nf/shared';
import { useTheme } from '../../hooks/useTheme';
import { categoryColor } from '../../lib/theme';
import { ChartCard } from './ChartCard';
import { EmptyState } from '../States';

interface Props {
  data: CategoryTotal[];
  total: number;
  compact: boolean;
  onSelectCategory?: (categoryId: string | null, categoryName: string) => void;
}

/** "$ 1.234.567" -> "$ 1,23M" para el centro de la dona. */
function short(amount: number): string {
  if (amount >= 1_000_000) return `$ ${(amount / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (amount >= 1_000) return `$ ${Math.round(amount / 1000)}k`;
  return formatCurrency(amount);
}

/**
 * Gasto del mes por rubro.
 *
 * La dona es un `conic-gradient`: no necesita librería de gráficos y se
 * anima sola. Al lado va siempre la lista con nombre, monto y porcentaje —
 * varios colores de rubro no llegan a 3:1 contra el fondo, así que la
 * identidad no puede depender solo del color.
 */
export function CategoryDonut({ data, total, compact, onSelectCategory }: Props) {
  const { theme } = useTheme();
  const rows = data.map((entry, index) => ({
    ...entry,
    display: categoryColor(entry.color, index, theme),
    share: total > 0 ? (entry.total / total) * 100 : 0,
  }));

  let cursor = 0;
  const stops = rows.map((row) => {
    const from = cursor;
    cursor += row.share;
    return `${row.display} ${from.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  const gradient =
    rows.length > 0
      ? `conic-gradient(from -90deg, ${stops.join(', ')})`
      : 'conic-gradient(rgb(var(--nf-raised-hover)) 0% 100%)';

  return (
    <ChartCard
      title="Por rubro"
      meta={`${rows.length} ${rows.length === 1 ? 'RUBRO' : 'RUBROS'} · SOLO CONFIRMADOS${
        onSelectCategory ? ' · TOCÁ UNO PARA VER EL DETALLE' : ''
      }`}
      delay="120ms"
    >
      {rows.length === 0 ? (
        <EmptyState
          title="Sin gastos este mes"
          description="Cuando cargues el primero, acá aparece cómo se reparte entre rubros."
        />
      ) : (
        <div className={`flex items-center gap-[26px] ${compact ? 'flex-wrap' : 'flex-nowrap'}`}>
          <div
            className="relative h-[186px] w-[186px] shrink-0 animate-[nf-fade_500ms_ease_both] rounded-full"
            style={{ background: gradient, animationDelay: '180ms' }}
            role="img"
            aria-label={`Distribución por rubro: ${rows
              .map((row) => `${row.category_name} ${row.share.toFixed(0)}%`)
              .join(', ')}`}
          >
            <div className="absolute inset-[27%] flex flex-col items-center justify-center gap-0.5 rounded-full bg-card">
              <span className="font-mono text-[9.5px] tracking-[0.08em] text-ink-faint">TOTAL</span>
              <span className="tabular text-[15px] font-semibold">{short(total)}</span>
            </div>
          </div>

          <ul
            className="m-0 flex min-w-0 flex-1 list-none flex-col gap-0.5 p-0"
            style={{ flexBasis: compact ? '180px' : '260px' }}
          >
            {rows.map((row) => (
              <li key={row.category_id ?? 'sin-rubro'}>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.(row.category_id, row.category_name)}
                  disabled={!onSelectCategory}
                  className="grid w-full grid-cols-[14px_1fr_auto_54px] items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-wash/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span
                    className="h-[11px] w-[11px] rounded-[3px]"
                    style={{ background: row.display, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)' }}
                    aria-hidden
                  />
                  <span className="truncate text-[13px] text-ink-bright">{row.category_name}</span>
                  <span className="tabular text-right text-[13px] text-ink-strong">
                    {formatCurrency(row.total)}
                  </span>
                  <span className="tabular text-right font-mono text-[11.5px] text-ink-secondary">
                    {row.share.toFixed(1)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
