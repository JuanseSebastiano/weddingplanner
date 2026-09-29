import {
  addMonths,
  monthBounds,
  type CashflowSummary,
  type LedgerEntry,
  type LedgerFilters,
  type Paginated,
} from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { soloDe } from '../lib/persona';
import { getMonthlyDeposits } from './savings';
import {
  buildTrend,
  round2,
  rowsInMonth,
  savingsRate,
  sortLedger,
  sumAmounts,
  toNumber,
  totalsByCategory,
  TREND_MONTHS,
  type CategoryRef,
  type FlowRow,
} from './cashflow-math';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
/**
 * Tope de filas que se traen para mezclar en memoria. El listado unificado
 * no se puede paginar en SQL porque sale de dos tablas, así que se trae el
 * rango completo y se corta acá. Un hogar hace cientos de movimientos por
 * mes: el tope solo existe para que un rango absurdo no voltee la función.
 */
const MERGE_LIMIT = 4000;

/**
 * Resumen de ingresos contra egresos del mes, con la tendencia de los
 * últimos 12 meses.
 *
 * Solo cuenta los gastos `confirmed`: un pendiente es una propuesta del
 * parser que nadie validó todavía, y meterlo en el balance mostraría un
 * neto que no refleja la realidad.
 */
export async function getCashflowSummary(
  coupleId: string,
  month: string,
  userId?: string,
): Promise<CashflowSummary> {
  const trendStart = monthBounds(addMonths(month, -(TREND_MONTHS - 1))).start;
  const { end: monthEnd } = monthBounds(month);
  const previous = addMonths(month, -1);

  const [incomesRes, expensesRes, categoriesRes, savingsTotal] = await Promise.all([
    soloDe(
      supabaseAdmin
        .from('fin_incomes')
        .select('amount, income_date, category_id')
        .eq('couple_id', coupleId)
        .gte('income_date', trendStart)
        .lte('income_date', monthEnd),
      userId,
    ),
    soloDe(
      supabaseAdmin
        .from('fin_expenses')
        .select('amount, expense_date, category_id')
        .eq('couple_id', coupleId)
        .eq('status', 'confirmed')
        .gte('expense_date', trendStart)
        .lte('expense_date', monthEnd),
      userId,
    ),
    supabaseAdmin.from('fin_categories').select('id, name, color').eq('couple_id', coupleId),
    getMonthlyDeposits(coupleId, month, userId),
  ]);

  for (const res of [incomesRes, expensesRes, categoriesRes]) {
    if (res.error) throw res.error;
  }

  const incomes: FlowRow[] = (
    (incomesRes.data ?? []) as Array<{ amount: number | string; income_date: string; category_id: string | null }>
  ).map((row) => ({ amount: row.amount, category_id: row.category_id, date: row.income_date }));

  const expenses: FlowRow[] = (
    (expensesRes.data ?? []) as Array<{ amount: number | string; expense_date: string; category_id: string | null }>
  ).map((row) => ({ amount: row.amount, category_id: row.category_id, date: row.expense_date }));

  const categories = (categoriesRes.data ?? []) as CategoryRef[];

  const monthIncomes = rowsInMonth(incomes, month);
  const monthExpenses = rowsInMonth(expenses, month);

  const incomeTotal = sumAmounts(monthIncomes);
  const expenseTotal = sumAmounts(monthExpenses);
  const previousNet =
    sumAmounts(rowsInMonth(incomes, previous)) - sumAmounts(rowsInMonth(expenses, previous));

  return {
    month,
    income_total: round2(incomeTotal),
    expense_total: round2(expenseTotal),
    net: round2(incomeTotal - expenseTotal),
    savings_rate: savingsRate(incomeTotal, expenseTotal),
    income_count: monthIncomes.length,
    expense_count: monthExpenses.length,
    previous_net: round2(previousNet),
    savings_total: savingsTotal,
    by_income_category: totalsByCategory(monthIncomes, categories),
    trend: buildTrend(incomes, expenses, month),
  };
}

interface JoinedRow {
  id: string;
  amount: number | string;
  currency: string;
  description: string | null;
  created_at: string;
  category: { id: string; name: string; color: string } | null;
  account: { id: string; name: string; type: string; last4: string | null } | null;
  profile: { id: string; display_name: string } | null;
}

const LEDGER_SELECT = `
  id, amount, currency, description, created_at, user_id, category_id,
  category:fin_categories (id, name, color),
  account:fin_accounts (id, name, type, last4),
  profile:couple_members!%FK% (id:user_id, display_name:nombre)
`;

/** Escapa los comodines de PostgREST para que la búsqueda sea literal. */
function escapeLike(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim();
}

/**
 * Listado cronológico con ingresos y egresos juntos.
 *
 * Las dos tablas se consultan por separado y se mezclan en memoria: no hay
 * forma de ordenar y paginar en SQL a través de dos tablas sin una vista, y
 * el volumen de un hogar no la justifica.
 */
export async function listLedger(
  coupleId: string,
  filters: LedgerFilters,
): Promise<Paginated<LedgerEntry>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.page_size ?? DEFAULT_PAGE_SIZE));
  const term = filters.search ? escapeLike(filters.search) : '';

  const wantIncomes = filters.kind !== 'expense';
  const wantExpenses = filters.kind !== 'income';

  const incomesPromise = wantIncomes
    ? (() => {
        let query = supabaseAdmin
          .from('fin_incomes')
          .select(`${LEDGER_SELECT.replace('%FK%', 'fin_incomes_user_id_fkey')}, income_date, payer`)
          .eq('couple_id', coupleId);
        if (filters.from) query = query.gte('income_date', filters.from);
        if (filters.to) query = query.lte('income_date', filters.to);
        if (filters.user_id) query = query.eq('user_id', filters.user_id);
        if (filters.category_id) query = query.eq('category_id', filters.category_id);
        if (term) query = query.or(`payer.ilike.%${term}%,description.ilike.%${term}%`);
        return query.order('income_date', { ascending: false }).limit(MERGE_LIMIT);
      })()
    : null;

  const expensesPromise = wantExpenses
    ? (() => {
        let query = supabaseAdmin
          .from('fin_expenses')
          .select(
            `${LEDGER_SELECT.replace('%FK%', 'fin_expenses_user_id_fkey')}, expense_date, merchant`,
          )
          .eq('couple_id', coupleId)
          .eq('status', 'confirmed');
        if (filters.from) query = query.gte('expense_date', filters.from);
        if (filters.to) query = query.lte('expense_date', filters.to);
        if (filters.user_id) query = query.eq('user_id', filters.user_id);
        if (filters.category_id) query = query.eq('category_id', filters.category_id);
        if (term) query = query.or(`merchant.ilike.%${term}%,description.ilike.%${term}%`);
        return query.order('expense_date', { ascending: false }).limit(MERGE_LIMIT);
      })()
    : null;

  const [incomesRes, expensesRes] = await Promise.all([incomesPromise, expensesPromise]);

  if (incomesRes?.error) throw incomesRes.error;
  if (expensesRes?.error) throw expensesRes.error;

  const toEntry = (
    row: JoinedRow,
    kind: 'income' | 'expense',
    date: string,
    party: string | null,
  ): LedgerEntry => ({
    id: row.id,
    kind,
    date,
    amount: toNumber(row.amount),
    currency: row.currency,
    counterparty: party,
    description: row.description,
    category: row.category,
    account: row.account as LedgerEntry['account'],
    profile: row.profile,
    created_at: row.created_at,
  });

  const entries = sortLedger([
    ...(
      (incomesRes?.data ?? []) as unknown as Array<JoinedRow & { income_date: string; payer: string | null }>
    ).map((row) => toEntry(row, 'income', row.income_date, row.payer)),
    ...(
      (expensesRes?.data ?? []) as unknown as Array<JoinedRow & { expense_date: string; merchant: string | null }>
    ).map((row) => toEntry(row, 'expense', row.expense_date, row.merchant)),
  ]);

  const from = (page - 1) * pageSize;
  return {
    items: entries.slice(from, from + pageSize),
    page,
    page_size: pageSize,
    total: entries.length,
  };
}
