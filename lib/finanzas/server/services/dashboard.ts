import {
  type AvailableSummary,
  addMonths,
  monthBounds,
  type BudgetWithCategory,
  type CategoryTotal,
  type DashboardSummary,
  type MonthlyPoint,
  type UserTotal,
} from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { buildBudgetStatuses } from './budget-math';
import { BUDGET_SELECT } from './budgets';

const TREND_MONTHS = 12;
const UNCATEGORIZED_COLOR = '#94a3b8';

interface ExpenseRow {
  amount: number | string;
  expense_date: string;
  user_id: string;
  category_id: string | null;
}

function toNumber(value: number | string): number {
  // numeric de Postgres llega como string por supabase-js.
  return typeof value === 'number' ? value : Number(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Distingue "esa tabla no existe" de cualquier otro error de la base. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205';
}

/**
 * Arma todo el dashboard con dos consultas: los gastos del rango de
 * tendencia (12 meses) y los catálogos de rubros y miembros. Los totales
 * se agregan en memoria — el volumen de un hogar es de cientos de filas
 * por mes, no vale la pena una vista materializada.
 */
export async function getDashboardSummary(
  coupleId: string,
  month: string,
): Promise<DashboardSummary> {
  const trendStart = monthBounds(addMonths(month, -(TREND_MONTHS - 1))).start;
  const { start: monthStart, end: monthEnd } = monthBounds(month);
  const previous = addMonths(month, -1);
  const { start: prevStart, end: prevEnd } = monthBounds(previous);

  const [expensesRes, categoriesRes, membersRes, pendingRes, incomesRes, budgetsRes] = await Promise.all([
    supabaseAdmin
      .from('fin_expenses')
      .select('amount, expense_date, user_id, category_id')
      .eq('couple_id', coupleId)
      .eq('status', 'confirmed')
      .gte('expense_date', trendStart)
      .lte('expense_date', monthEnd),
    supabaseAdmin.from('fin_categories').select('id, name, color').eq('couple_id', coupleId),
    supabaseAdmin.from('couple_members').select('id:user_id, display_name:nombre').eq('couple_id', coupleId).not('user_id', 'is', null),
    supabaseAdmin
      .from('fin_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .eq('status', 'pending'),
    // Solo el mes consultado: el dashboard usa el ingreso para la tarjeta
    // de balance, no para la tendencia (esa vive en la sección Balance).
    supabaseAdmin
      .from('fin_incomes')
      .select('amount')
      .eq('couple_id', coupleId)
      .gte('income_date', monthStart)
      .lte('income_date', monthEnd),
    // Los topes no dependen del mes: son recurrentes y se comparan contra
    // el gasto del mes consultado más abajo.
    supabaseAdmin.from('fin_budgets').select(BUDGET_SELECT).eq('couple_id', coupleId),
  ]);

  for (const res of [expensesRes, categoriesRes, membersRes, pendingRes]) {
    if (res.error) throw res.error;
  }

  // El dashboard es la pantalla de inicio y ya funcionaba sin ingresos: si
  // el código se despliega antes de correr 0005_incomes.sql, la tabla no
  // existe todavía y no vale la pena voltear toda la pantalla por la
  // tarjeta de balance. Se degrada a cero y el resto sigue igual.
  //
  // El descarte es solo para "la tabla no está" (42P01 en Postgres,
  // PGRST205 en PostgREST); cualquier otro error se propaga.
  if (incomesRes.error && !isMissingTable(incomesRes.error)) throw incomesRes.error;

  // Mismo criterio para los topes (0007_budgets.sql): sin la tabla el
  // dashboard sigue mostrando todo lo demás, solo que sin presupuestos.
  if (budgetsRes.error && !isMissingTable(budgetsRes.error)) throw budgetsRes.error;

  const rows = (expensesRes.data ?? []) as ExpenseRow[];
  const categories = (categoriesRes.data ?? []) as Array<{ id: string; name: string; color: string }>;
  const members = (membersRes.data ?? []) as Array<{ id: string; display_name: string }>;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const inCurrentMonth = (row: ExpenseRow) =>
    row.expense_date >= monthStart && row.expense_date <= monthEnd;

  // --- Totales del mes -------------------------------------------------
  const monthRows = rows.filter(inCurrentMonth);
  const monthTotal = monthRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const previousMonthTotal = rows
    .filter((row) => row.expense_date >= prevStart && row.expense_date <= prevEnd)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);

  const incomeTotal = ((incomesRes.data ?? []) as Array<{ amount: number | string }>).reduce(
    (sum, row) => sum + toNumber(row.amount),
    0,
  );

  // --- Por rubro -------------------------------------------------------
  const categoryTotals = new Map<string, CategoryTotal>();
  for (const row of monthRows) {
    const key = row.category_id ?? 'sin-rubro';
    const category = row.category_id ? categoryById.get(row.category_id) : undefined;
    const entry = categoryTotals.get(key) ?? {
      category_id: row.category_id,
      category_name: category?.name ?? 'Sin rubro',
      color: category?.color ?? UNCATEGORIZED_COLOR,
      total: 0,
      count: 0,
    };
    entry.total += toNumber(row.amount);
    entry.count += 1;
    categoryTotals.set(key, entry);
  }

  const byCategory = [...categoryTotals.values()]
    .map((entry) => ({ ...entry, total: round2(entry.total) }))
    .sort((a, b) => b.total - a.total);

  // --- Topes de presupuesto --------------------------------------------
  // Reusa el desglose que ya está calculado: lo gastado por rubro en el mes
  // es exactamente el número contra el que hay que comparar el tope.
  const spentByCategory = new Map<string, number>(
    byCategory
      .filter((entry): entry is CategoryTotal & { category_id: string } => entry.category_id !== null)
      .map((entry) => [entry.category_id, entry.total]),
  );
  const budgets = buildBudgetStatuses(
    (budgetsRes.data ?? []) as unknown as BudgetWithCategory[],
    spentByCategory,
  );

  // --- Comparativa entre las dos cuentas -------------------------------
  const userTotals = new Map<string, UserTotal>(
    members.map((member) => [
      member.id,
      { user_id: member.id, display_name: member.display_name, total: 0, count: 0 },
    ]),
  );
  for (const row of monthRows) {
    const entry = userTotals.get(row.user_id) ?? {
      user_id: row.user_id,
      display_name: memberById.get(row.user_id)?.display_name ?? 'Desconocido',
      total: 0,
      count: 0,
    };
    entry.total += toNumber(row.amount);
    entry.count += 1;
    userTotals.set(row.user_id, entry);
  }

  const byUser = [...userTotals.values()]
    .map((entry) => ({ ...entry, total: round2(entry.total) }))
    .sort((a, b) => b.total - a.total);

  // --- Tendencia mensual ------------------------------------------------
  const trendMonths: string[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) trendMonths.push(addMonths(month, -i));

  const trendIndex = new Map<string, MonthlyPoint>(
    trendMonths.map((m) => [
      m,
      { month: m, total: 0, by_user: Object.fromEntries(members.map((member) => [member.id, 0])) },
    ]),
  );

  for (const row of rows) {
    const key = row.expense_date.slice(0, 7);
    const point = trendIndex.get(key);
    if (!point) continue;
    const amount = toNumber(row.amount);
    point.total += amount;
    point.by_user[row.user_id] = (point.by_user[row.user_id] ?? 0) + amount;
  }

  const trend = trendMonths.map((m) => {
    const point = trendIndex.get(m)!;
    return {
      month: m,
      total: round2(point.total),
      by_user: Object.fromEntries(
        Object.entries(point.by_user).map(([userId, total]) => [userId, round2(total)]),
      ),
    };
  });

  return {
    month,
    month_total: round2(monthTotal),
    previous_month_total: round2(previousMonthTotal),
    income_total: round2(incomeTotal),
    net: round2(incomeTotal - monthTotal),
    expense_count: monthRows.length,
    pending_count: pendingRes.count ?? 0,
    by_category: byCategory,
    by_user: byUser,
    trend,
    members: members.map((member) => ({ id: member.id, display_name: member.display_name })),
    budgets,
  };
}

/**
 * Lee las vistas fin_available_now y fin_card_debt (ver 0007_finanzas.sql),
 * donde vive la regla de qué parte de la tarjeta sigue impaga.
 */
export async function getAvailableSummary(coupleId: string): Promise<AvailableSummary> {
  const [totalsRes, cardsRes] = await Promise.all([
    supabaseAdmin
      .from('fin_available_now')
      .select('currency, liquid, card_debt, available')
      .eq('couple_id', coupleId)
      .order('currency'),
    supabaseAdmin
      .from('fin_card_debt')
      .select('account_id, name, currency, unpaid_since, debt')
      .eq('couple_id', coupleId)
      .order('name'),
  ]);
  if (totalsRes.error) throw totalsRes.error;
  if (cardsRes.error) throw cardsRes.error;

  return {
    totals: (totalsRes.data ?? []).map((row) => ({
      currency: row.currency,
      liquid: Number(row.liquid),
      card_debt: Number(row.card_debt),
      available: Number(row.available),
    })),
    cards: (cardsRes.data ?? []).map((row) => ({ ...row, debt: Number(row.debt) })),
  };
}
