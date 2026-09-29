/**
 * Lógica pura del balance: agregación de ingresos y egresos, sin acceso a
 * base de datos, para poder testear la aritmética del mes y del listado
 * unificado sin levantar Supabase.
 */
import { addMonths, monthBounds, type CashflowPoint, type CategoryTotal, type LedgerEntry } from '@nf/shared';

export const TREND_MONTHS = 12;
const UNCATEGORIZED_COLOR = '#94a3b8';

/** Fila mínima que necesita la agregación, venga de `incomes` o `expenses`. */
export interface FlowRow {
  /** Formato YYYY-MM-DD. */
  date: string;
  amount: number | string;
  category_id: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  color: string;
}

/** numeric de Postgres llega como string por supabase-js. */
export function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumAmounts(rows: FlowRow[]): number {
  return rows.reduce((acc, row) => acc + toNumber(row.amount), 0);
}

/** Filas cuya fecha cae dentro del mes YYYY-MM. */
export function rowsInMonth<T extends FlowRow>(rows: T[], month: string): T[] {
  const { start, end } = monthBounds(month);
  return rows.filter((row) => row.date >= start && row.date <= end);
}

/**
 * Porcentaje del ingreso que no se gastó.
 *
 * `null` cuando no hubo ingresos: sin denominador la tasa no significa
 * nada, y devolver 0 haría parecer que se gastó todo lo que entró.
 */
export function savingsRate(incomeTotal: number, expenseTotal: number): number | null {
  if (incomeTotal <= 0) return null;
  return round2(((incomeTotal - expenseTotal) / incomeTotal) * 100);
}

/** Desglose por rubro, ordenado de mayor a menor. */
export function totalsByCategory(rows: FlowRow[], categories: CategoryRef[]): CategoryTotal[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totals = new Map<string, CategoryTotal>();

  for (const row of rows) {
    const key = row.category_id ?? 'sin-rubro';
    const category = row.category_id ? categoryById.get(row.category_id) : undefined;
    const entry = totals.get(key) ?? {
      category_id: row.category_id,
      category_name: category?.name ?? 'Sin rubro',
      color: category?.color ?? UNCATEGORIZED_COLOR,
      total: 0,
      count: 0,
    };
    entry.total += toNumber(row.amount);
    entry.count += 1;
    totals.set(key, entry);
  }

  return [...totals.values()]
    .map((entry) => ({ ...entry, total: round2(entry.total) }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Serie de los últimos `TREND_MONTHS` meses hasta `month` inclusive.
 * Los meses sin movimientos se devuelven en cero, no se saltean: el
 * gráfico necesita el hueco para que el eje no mienta.
 */
export function buildTrend(
  incomes: FlowRow[],
  expenses: FlowRow[],
  month: string,
): CashflowPoint[] {
  const months: string[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) months.push(addMonths(month, -i));

  const index = new Map<string, CashflowPoint>(
    months.map((m) => [m, { month: m, income: 0, expense: 0, net: 0 }]),
  );

  for (const row of incomes) {
    const point = index.get(row.date.slice(0, 7));
    if (point) point.income += toNumber(row.amount);
  }
  for (const row of expenses) {
    const point = index.get(row.date.slice(0, 7));
    if (point) point.expense += toNumber(row.amount);
  }

  return months.map((m) => {
    const point = index.get(m)!;
    return {
      month: m,
      income: round2(point.income),
      expense: round2(point.expense),
      net: round2(point.income - point.expense),
    };
  });
}

/**
 * Ordena el listado unificado: fecha del movimiento primero y, ante
 * empate, el cargado más recientemente. Sin el desempate por `created_at`
 * el orden de dos movimientos del mismo día dependería de en qué tabla
 * cayeron, que es justo lo que no tiene que verse.
 */
export function sortLedger(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) =>
    a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date),
  );
}
