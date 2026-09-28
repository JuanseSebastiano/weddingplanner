import { currentMonth, type SavingsCash, type SavingsMovementWithRelations } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { summarizeCash, type MovementRow } from './savings-math';

export const SAVINGS_SELECT = `
  *,
  account:fin_accounts (id, name, last4),
  holding:fin_holdings (id, ticker),
  profile:couple_members!fin_savings_movements_user_id_fkey (id:user_id, display_name:nombre)
`;

/**
 * La caja de ahorro todavía puede no existir: 0008_savings_movements.sql se
 * corre a mano desde el editor SQL de Supabase, así que un deploy puede
 * llegar antes que la migración. Mismo criterio que `incomes` y `budgets` en
 * el dashboard: sin la tabla, la sección Ahorros muestra las tenencias y una
 * caja en cero en vez de romperse entera.
 */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01';
}

export const EMPTY_CASH: SavingsCash = {
  available: 0,
  deposited: 0,
  withdrawn: 0,
  invested: 0,
  deposited_this_month: 0,
};

export async function listMovements(coupleId: string): Promise<SavingsMovementWithRelations[]> {
  const { data, error } = await supabaseAdmin
    .from('fin_savings_movements')
    .select(SAVINGS_SELECT)
    .eq('couple_id', coupleId)
    .order('moved_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as unknown as SavingsMovementWithRelations[];
}

export async function getMovement(
  coupleId: string,
  id: string,
): Promise<SavingsMovementWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_savings_movements')
    .select(SAVINGS_SELECT)
    .eq('couple_id', coupleId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as SavingsMovementWithRelations) ?? null;
}

/**
 * Estado de la caja. Trae solo las tres columnas que hacen falta para la
 * cuenta, no los joins del listado.
 */
export async function getCash(coupleId: string, month = currentMonth()): Promise<SavingsCash> {
  const { data, error } = await supabaseAdmin
    .from('fin_savings_movements')
    .select('kind, amount, moved_at')
    .eq('couple_id', coupleId);

  if (error) {
    if (isMissingTable(error)) return EMPTY_CASH;
    throw error;
  }
  return summarizeCash((data ?? []) as MovementRow[], month);
}

/** Lo apartado en un mes concreto, para el resumen de Balance. */
export async function getMonthlyDeposits(coupleId: string, month: string): Promise<number> {
  return (await getCash(coupleId, month)).deposited_this_month;
}
