import type { HoldingWithRelations } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { soloDe } from '../lib/persona';

export const HOLDING_SELECT = `
  *,
  profile:couple_members!fin_holdings_user_id_fkey (id:user_id, display_name:nombre)
`;

export async function listHoldings(coupleId: string, userId?: string): Promise<HoldingWithRelations[]> {
  const { data, error } = await soloDe(
    supabaseAdmin.from('fin_holdings').select(HOLDING_SELECT).eq('couple_id', coupleId),
    userId,
  ).order('ticker');

  if (error) throw error;
  return (data ?? []) as unknown as HoldingWithRelations[];
}

export async function getHolding(
  coupleId: string,
  id: string,
): Promise<HoldingWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_holdings')
    .select(HOLDING_SELECT)
    .eq('couple_id', coupleId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as HoldingWithRelations) ?? null;
}
