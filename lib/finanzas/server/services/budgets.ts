import type { BudgetWithCategory } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';

export const BUDGET_SELECT = `
  *,
  category:fin_categories (id, name, color)
`;

export async function listBudgets(coupleId: string): Promise<BudgetWithCategory[]> {
  const { data, error } = await supabaseAdmin
    .from('fin_budgets')
    .select(BUDGET_SELECT)
    .eq('couple_id', coupleId);

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
