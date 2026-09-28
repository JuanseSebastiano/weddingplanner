import type { CategorizationRule } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { findMatchingRule, type RuleMatch, type RuleSubject } from './rules-matcher';

export { findMatchingRule, ruleMatches } from './rules-matcher';
export type { RuleMatch, RuleSubject } from './rules-matcher';

export async function loadRules(coupleId: string): Promise<CategorizationRule[]> {
  const { data, error } = await supabaseAdmin
    .from('fin_categorization_rules')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CategorizationRule[];
}

/** Categoriza un gasto suelto. Devuelve null si ninguna regla aplica. */
export async function categorize(coupleId: string, subject: RuleSubject): Promise<RuleMatch | null> {
  const rules = await loadRules(coupleId);
  return findMatchingRule(rules, subject);
}

export interface ApplyRulesResult {
  scanned: number;
  updated: number;
  /** Cuántos gastos tocó cada regla, por rule_id. */
  by_rule: Record<string, number>;
}

/**
 * Corre las reglas sobre los gastos del hogar que todavía no tienen rubro.
 * Con `dryRun` informa qué pasaría sin escribir nada — así la UI de reglas
 * puede previsualizar el impacto antes de aplicar.
 */
export async function applyRulesToUncategorized(
  coupleId: string,
  options: { dryRun?: boolean; includeCategorized?: boolean } = {},
): Promise<ApplyRulesResult> {
  const rules = await loadRules(coupleId);
  const result: ApplyRulesResult = { scanned: 0, updated: 0, by_rule: {} };
  if (rules.length === 0) return result;

  let query = supabaseAdmin
    .from('fin_expenses')
    .select('id, merchant, description, category_id')
    .eq('couple_id', coupleId)
    .neq('status', 'discarded');

  if (!options.includeCategorized) query = query.is('category_id', null);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    merchant: string | null;
    description: string | null;
    category_id: string | null;
  }>;
  result.scanned = rows.length;

  for (const row of rows) {
    const match = findMatchingRule(rules, { merchant: row.merchant, description: row.description });
    if (!match || match.category_id === row.category_id) continue;

    result.updated += 1;
    result.by_rule[match.rule.id] = (result.by_rule[match.rule.id] ?? 0) + 1;

    if (!options.dryRun) {
      const { error: updateError } = await supabaseAdmin
        .from('fin_expenses')
        .update({ category_id: match.category_id, applied_rule_id: match.rule.id })
        .eq('id', row.id)
        .eq('couple_id', coupleId);
      if (updateError) throw updateError;
    }
  }

  return result;
}
