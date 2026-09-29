import { describe, expect, it } from 'vitest';
import type { CategorizationRule } from '@nf/shared';
import { findMatchingRule, ruleMatches } from '../server/services/rules-matcher';

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'rule-1',
    couple_id: 'hh-1',
    name: 'Regla',
    priority: 100,
    match_field: 'merchant',
    match_type: 'contains',
    pattern: 'coto',
    category_id: 'cat-super',
    account_id: null,
    active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ruleMatches', () => {
  it('contains ignora mayúsculas y acentos', () => {
    expect(ruleMatches(rule({ pattern: 'almacen' }), { merchant: 'ALMACÉN DON JOSÉ' })).toBe(true);
  });

  it('equals exige el valor completo', () => {
    const r = rule({ match_type: 'equals', pattern: 'coto' });
    expect(ruleMatches(r, { merchant: 'Coto' })).toBe(true);
    expect(ruleMatches(r, { merchant: 'Coto Cicsa' })).toBe(false);
  });

  it('regex funciona con alternativas', () => {
    const r = rule({ match_type: 'regex', pattern: '(coto|jumbo|carrefour)' });
    expect(ruleMatches(r, { merchant: 'Jumbo Palermo' })).toBe(true);
    expect(ruleMatches(r, { merchant: 'Farmacity' })).toBe(false);
  });

  it('una regex inválida no rompe la ingesta', () => {
    const r = rule({ match_type: 'regex', pattern: '([sin cerrar' });
    expect(ruleMatches(r, { merchant: 'Cualquiera' })).toBe(false);
  });

  it('evalúa el campo indicado y no otro', () => {
    const r = rule({ match_field: 'sender', pattern: 'santander' });
    expect(ruleMatches(r, { merchant: 'Santander', sender: 'avisos@bbva.com' })).toBe(false);
    expect(ruleMatches(r, { merchant: 'Coto', sender: 'alertas@santander.com.ar' })).toBe(true);
  });

  it('no matchea cuando el campo viene vacío', () => {
    expect(ruleMatches(rule(), { merchant: null })).toBe(false);
  });
});

describe('findMatchingRule', () => {
  it('respeta el orden de prioridad', () => {
    const rules = [
      rule({ id: 'baja', priority: 200, pattern: 'coto', category_id: 'cat-otros' }),
      rule({ id: 'alta', priority: 10, pattern: 'coto', category_id: 'cat-super' }),
    ];
    expect(findMatchingRule(rules, { merchant: 'Coto Cicsa' })?.category_id).toBe('cat-super');
  });

  it('a igual prioridad gana la más antigua', () => {
    const rules = [
      rule({ id: 'nueva', created_at: '2026-06-01T00:00:00Z', category_id: 'cat-nueva' }),
      rule({ id: 'vieja', created_at: '2026-01-01T00:00:00Z', category_id: 'cat-vieja' }),
    ];
    expect(findMatchingRule(rules, { merchant: 'Coto' })?.category_id).toBe('cat-vieja');
  });

  it('ignora las reglas desactivadas', () => {
    const rules = [rule({ active: false })];
    expect(findMatchingRule(rules, { merchant: 'Coto' })).toBeNull();
  });

  it('devuelve null cuando ninguna regla aplica', () => {
    expect(findMatchingRule([rule()], { merchant: 'Farmacity' })).toBeNull();
  });

  it('propaga la cuenta cuando la regla la define', () => {
    const rules = [rule({ account_id: 'acc-1' })];
    expect(findMatchingRule(rules, { merchant: 'Coto' })?.account_id).toBe('acc-1');
  });
});
