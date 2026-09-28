import type { IncomeFilters, IncomeWithRelations, Paginated } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { badRequest } from '../lib/errors';

/** Mismos joins que el listado de gastos: rubro, cuenta y quién lo cargó. */
export const INCOME_SELECT = `
  *,
  category:fin_categories (id, name, color),
  account:fin_accounts (id, name, type, last4),
  profile:couple_members!fin_incomes_user_id_fkey (id:user_id, display_name:nombre)
`;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Escapa los comodines de PostgREST para que la búsqueda sea literal. */
function escapeLike(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim();
}

export async function listIncomes(
  coupleId: string,
  filters: IncomeFilters,
): Promise<Paginated<IncomeWithRelations>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.page_size ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('fin_incomes')
    .select(INCOME_SELECT, { count: 'exact' })
    .eq('couple_id', coupleId);

  if (filters.from) query = query.gte('income_date', filters.from);
  if (filters.to) query = query.lte('income_date', filters.to);
  if (filters.user_id) query = query.eq('user_id', filters.user_id);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.account_id) query = query.eq('account_id', filters.account_id);

  if (filters.search) {
    const term = escapeLike(filters.search);
    if (term) query = query.or(`payer.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order('income_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  return {
    items: (data ?? []) as unknown as IncomeWithRelations[],
    page,
    page_size: pageSize,
    total: count ?? 0,
  };
}

export async function getIncome(
  coupleId: string,
  id: string,
): Promise<IncomeWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_incomes')
    .select(INCOME_SELECT)
    .eq('couple_id', coupleId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as IncomeWithRelations) ?? null;
}

/**
 * Valida que el rubro y la cuenta sean del hogar antes de imputar, y que
 * el rubro sea de ingreso.
 *
 * Lo del `kind` no es un detalle: la base acepta cualquier category_id, así
 * que sin este chequeo un ingreso podría quedar imputado a "Supermercado"
 * y aparecer mezclado en el desglose de gastos.
 */
export async function assertIncomeRefs(
  coupleId: string,
  refs: { categoryId?: string | null; accountId?: string | null },
): Promise<void> {
  if (refs.categoryId) {
    const { data, error } = await supabaseAdmin
      .from('fin_categories')
      .select('id, kind')
      .eq('id', refs.categoryId)
      .eq('couple_id', coupleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw badRequest('El rubro no pertenece a este hogar');
    if (data.kind !== 'income') throw badRequest('Ese rubro es de egresos, no de ingresos');
  }

  if (refs.accountId) {
    const { data, error } = await supabaseAdmin
      .from('fin_accounts')
      .select('id')
      .eq('id', refs.accountId)
      .eq('couple_id', coupleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw badRequest('La cuenta no pertenece a este hogar');
  }
}
