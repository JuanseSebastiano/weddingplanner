import type { ExpenseFilters, ExpenseWithRelations, Paginated } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { badRequest } from '../lib/errors';

/** Joins que devuelven los listados: rubro, cuenta y quién cargó el gasto. */
export const EXPENSE_SELECT = `
  *,
  category:fin_categories (id, name, color),
  account:fin_accounts (id, name, type, last4),
  profile:couple_members!fin_expenses_user_id_fkey (id:user_id, display_name:nombre)
`;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Escapa los comodines de PostgREST para que la búsqueda sea literal. */
function escapeLike(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim();
}

export async function listExpenses(
  coupleId: string,
  filters: ExpenseFilters,
): Promise<Paginated<ExpenseWithRelations>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.page_size ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('fin_expenses')
    .select(EXPENSE_SELECT, { count: 'exact' })
    .eq('couple_id', coupleId);

  // Por defecto la vista de detalle muestra solo lo imputado: los pendientes
  // viven en la vista de revisión y los descartados no se muestran.
  query = filters.status ? query.eq('status', filters.status) : query.eq('status', 'confirmed');

  if (filters.from) query = query.gte('expense_date', filters.from);
  if (filters.to) query = query.lte('expense_date', filters.to);
  if (filters.user_id) query = query.eq('user_id', filters.user_id);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.account_id) query = query.eq('account_id', filters.account_id);
  if (filters.source) query = query.eq('source', filters.source);

  if (filters.search) {
    const term = escapeLike(filters.search);
    if (term) query = query.or(`merchant.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  return {
    items: (data ?? []) as unknown as ExpenseWithRelations[],
    page,
    page_size: pageSize,
    total: count ?? 0,
  };
}

export async function getExpense(
  coupleId: string,
  id: string,
): Promise<ExpenseWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_expenses')
    .select(EXPENSE_SELECT)
    .eq('couple_id', coupleId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ExpenseWithRelations) ?? null;
}

/**
 * Valida que el rubro y la cuenta pertenezcan al hogar antes de imputar.
 * Sin esto, un client podría referenciar IDs de otro hogar (el backend usa
 * service role y no lo frenaría RLS).
 *
 * El rubro además tiene que ser de egresos: desde que existen los de
 * ingreso, la FK sola ya no alcanza para que un gasto no termine imputado
 * a "Sueldo".
 */
export async function assertBelongsToHousehold(
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
    if (data.kind !== 'expense') throw badRequest('Ese rubro es de ingresos, no de egresos');
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
