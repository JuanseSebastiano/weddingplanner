/**
 * Lógica pura del motor de reglas: sin acceso a base de datos, para
 * poder testearla y reusarla desde la ingesta de mails y el CRUD.
 */
import type { CategorizationRule } from '@nf/shared';

/** Campos contra los que se evalúa una regla. */
export interface RuleSubject {
  merchant?: string | null;
  description?: string | null;
  sender?: string | null;
}

export interface RuleMatch {
  rule: CategorizationRule;
  category_id: string;
  account_id: string | null;
}

function normalize(value: string): string {
  // Sin acentos y en minúsculas: "Almacén" matchea "almacen".
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function subjectValue(subject: RuleSubject, field: CategorizationRule['match_field']): string | null {
  const raw =
    field === 'merchant' ? subject.merchant : field === 'sender' ? subject.sender : subject.description;
  return raw ?? null;
}

/** Evalúa una sola regla. Una regex inválida nunca rompe la ingesta: devuelve false. */
export function ruleMatches(rule: CategorizationRule, subject: RuleSubject): boolean {
  const value = subjectValue(subject, rule.match_field);
  if (!value) return false;

  if (rule.match_type === 'regex') {
    try {
      return new RegExp(rule.pattern, 'i').test(value);
    } catch {
      return false;
    }
  }

  const haystack = normalize(value);
  const needle = normalize(rule.pattern);
  if (!needle) return false;

  return rule.match_type === 'equals' ? haystack === needle : haystack.includes(needle);
}

/**
 * Devuelve la primera regla que matchea, respetando el orden por prioridad
 * (menor número = se evalúa antes; a igual prioridad, la más antigua).
 */
export function findMatchingRule(rules: CategorizationRule[], subject: RuleSubject): RuleMatch | null {
  const ordered = [...rules]
    .filter((rule) => rule.active)
    .sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));

  for (const rule of ordered) {
    if (ruleMatches(rule, subject)) {
      return { rule, category_id: rule.category_id, account_id: rule.account_id };
    }
  }
  return null;
}
