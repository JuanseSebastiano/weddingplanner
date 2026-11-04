import { formatCurrency, monthBounds, type BudgetWithCategory, type MonthlyPlan } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { badRequest } from '../lib/errors';
import { buildMonthlyPlan, round2, type PlanRubroInput } from './budget-math';

export const BUDGET_SELECT = `
  *,
  category:fin_categories (id, name, color)
`;

/** Topes de una persona (Configuración muestra solo los propios). */
export async function listBudgets(coupleId: string, userId: string): Promise<BudgetWithCategory[]> {
  const { data, error } = await supabaseAdmin
    .from('fin_budgets')
    .select(BUDGET_SELECT)
    .eq('couple_id', coupleId)
    .eq('user_id', userId);

  if (error) throw error;

  // El orden lo da el nombre del rubro, que vive en el join: PostgREST no
  // ordena por columnas de una tabla embebida, así que se ordena acá.
  return ((data ?? []) as unknown as BudgetWithCategory[]).sort((a, b) =>
    (a.category?.name ?? '').localeCompare(b.category?.name ?? '', 'es'),
  );
}

export async function getBudget(
  coupleId: string,
  id: string,
): Promise<BudgetWithCategory | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_budgets')
    .select(BUDGET_SELECT)
    .eq('couple_id', coupleId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as BudgetWithCategory) ?? null;
}

/**
 * Presupuesto mensual de una persona (`userId`) o de la pareja (null): tope,
 * topes por rubro y lo gastado en el mes, con los recortes a los variables
 * ya calculados. El de la pareja es la suma de los de cada uno.
 */
export async function getMonthlyPlan(coupleId: string, month: string, userId: string | null): Promise<MonthlyPlan> {
  const { start, end } = monthBounds(month);
  let membersQuery = supabaseAdmin.from('couple_members').select('fin_tope_mensual').eq('couple_id', coupleId).not('user_id', 'is', null);
  let budgetsQuery = supabaseAdmin.from('fin_budgets').select('id, category_id, amount').eq('couple_id', coupleId);
  let expensesQuery = supabaseAdmin
    .from('fin_expenses')
    .select('amount, category_id')
    .eq('couple_id', coupleId)
    .eq('status', 'confirmed')
    .gte('expense_date', start)
    .lte('expense_date', end);
  if (userId) {
    membersQuery = membersQuery.eq('user_id', userId);
    budgetsQuery = budgetsQuery.eq('user_id', userId);
    expensesQuery = expensesQuery.eq('user_id', userId);
  }
  const [membersRes, categoriesRes, budgetsRes, expensesRes] = await Promise.all([
    membersQuery,
    supabaseAdmin.from('fin_categories').select('id, name, color, variable').eq('couple_id', coupleId).eq('kind', 'expense'),
    budgetsQuery,
    expensesQuery,
  ]);
  for (const res of [membersRes, categoriesRes, budgetsRes, expensesRes]) {
    if (res.error) throw res.error;
  }

  const spent = new Map<string | null, number>();
  for (const row of expensesRes.data ?? []) {
    spent.set(row.category_id, (spent.get(row.category_id) ?? 0) + Number(row.amount));
  }
  // Juntos se suman los topes de cada uno; budget_id solo vale en la vista de una persona.
  const budgetBy = new Map<string, { id: string | null; amount: number }>();
  for (const b of budgetsRes.data ?? []) {
    const prev = budgetBy.get(b.category_id as string);
    budgetBy.set(b.category_id as string, {
      id: userId ? (b.id as string) : null,
      amount: (prev?.amount ?? 0) + Number(b.amount),
    });
  }

  const rubros: PlanRubroInput[] = (categoriesRes.data ?? [])
    .map((c) => {
      const budget = budgetBy.get(c.id);
      return {
        category_id: c.id as string,
        name: c.name as string,
        color: c.color as string,
        variable: Boolean(c.variable),
        budget_id: budget?.id ?? null,
        amount: budget?.amount ?? 0,
        spent: round2(spent.get(c.id) ?? 0),
      };
    })
    .sort((a, b) => Number(a.variable) - Number(b.variable) || a.name.localeCompare(b.name, 'es'));
  if (spent.has(null)) {
    rubros.push({
      category_id: null,
      name: 'Sin rubro',
      color: '#94a3b8',
      variable: false,
      budget_id: null,
      amount: 0,
      spent: round2(spent.get(null) ?? 0),
    });
  }

  const caps = (membersRes.data ?? []).map((m) => m.fin_tope_mensual).filter((c) => c !== null && c !== undefined);
  const cap = caps.length ? caps.reduce((acc, c) => acc + Number(c), 0) : null;
  return buildMonthlyPlan(month, cap, rubros);
}

/**
 * Los topes por rubro de una persona no pueden sumar más que su tope
 * mensual. `cambio` es el tope que se está por guardar (o el nuevo tope
 * mensual, con `cap`).
 */
export async function assertWithinCap(
  coupleId: string,
  userId: string,
  cambio: { categoryId: string; amount: number } | { cap: number },
): Promise<void> {
  const [memberRes, budgetsRes] = await Promise.all([
    supabaseAdmin.from('couple_members').select('fin_tope_mensual').eq('user_id', userId).single(),
    supabaseAdmin.from('fin_budgets').select('category_id, amount').eq('couple_id', coupleId).eq('user_id', userId),
  ]);
  if (memberRes.error) throw memberRes.error;
  if (budgetsRes.error) throw budgetsRes.error;

  const cap = 'cap' in cambio ? cambio.cap : memberRes.data?.fin_tope_mensual;
  if (cap === null || cap === undefined) return;

  const total = (budgetsRes.data ?? []).reduce(
    (acc, b) => acc + ('categoryId' in cambio && b.category_id === cambio.categoryId ? 0 : Number(b.amount)),
    'categoryId' in cambio ? cambio.amount : 0,
  );
  if (total > Number(cap) + 0.005) {
    throw badRequest(
      `Los rubros sumarían ${formatCurrency(total)} y el tope mensual es ${formatCurrency(Number(cap))}. Bajá algún rubro o subí el tope.`,
    );
  }
}
