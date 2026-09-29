import { describe, expect, it } from 'vitest';
import type { BudgetWithCategory } from '@nf/shared';
import {
  buildBudgetStatuses,
  budgetPct,
  budgetState,
  describeBudget,
  needsAttention,
} from '../server/services/budget-math';

describe('budgetPct', () => {
  it('calcula el porcentaje consumido', () => {
    expect(budgetPct(50000, 200000)).toBe(25);
  });

  it('pasa de 100 cuando se gastó más que el tope', () => {
    expect(budgetPct(250000, 200000)).toBe(125);
  });

  it('redondea a dos decimales', () => {
    expect(budgetPct(1, 3)).toBe(33.33);
  });

  it('devuelve 0 con un tope de cero, en vez de Infinity', () => {
    expect(budgetPct(1000, 0)).toBe(0);
  });
});

describe('budgetState', () => {
  it('es "ok" bien por debajo del tope', () => {
    expect(budgetState(50000, 200000)).toBe('ok');
  });

  it('es "ok" justo debajo del umbral de aviso', () => {
    // 79,99% de 200.000: todavía no avisa.
    expect(budgetState(159980, 200000)).toBe('ok');
  });

  it('avisa exactamente al 80% del tope', () => {
    expect(budgetState(160000, 200000)).toBe('warning');
  });

  it('sigue avisando entre el 80% y el tope', () => {
    expect(budgetState(190000, 200000)).toBe('warning');
  });

  it('gastar exactamente el tope todavía no es pasarse', () => {
    expect(budgetState(200000, 200000)).toBe('warning');
  });

  it('un peso por encima del tope ya es "exceeded"', () => {
    expect(budgetState(200001, 200000)).toBe('exceeded');
  });

  it('no rompe con un tope de cero', () => {
    expect(budgetState(1000, 0)).toBe('ok');
  });
});

describe('describeBudget', () => {
  it('deja lo que queda del tope', () => {
    expect(describeBudget(120000, 200000)).toEqual({
      spent: 120000,
      remaining: 80000,
      pct: 60,
      state: 'ok',
    });
  });

  it('devuelve remaining negativo cuando se pasó', () => {
    expect(describeBudget(250000, 200000)).toEqual({
      spent: 250000,
      remaining: -50000,
      pct: 125,
      state: 'exceeded',
    });
  });
});

describe('needsAttention', () => {
  it('solo es verdadero cuando hay algo que avisar', () => {
    expect(needsAttention('ok')).toBe(false);
    expect(needsAttention('warning')).toBe(true);
    expect(needsAttention('exceeded')).toBe(true);
  });
});

function budget(overrides: Partial<BudgetWithCategory> = {}): BudgetWithCategory {
  return {
    id: 'b1',
    couple_id: 'h1',
    category_id: 'c1',
    amount: 200000,
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    category: { id: 'c1', name: 'Supermercado', color: '#2a78d6' },
    ...overrides,
  };
}

describe('buildBudgetStatuses', () => {
  it('cruza cada tope con lo gastado en su rubro', () => {
    const [status] = buildBudgetStatuses([budget()], new Map([['c1', 150000]]));
    expect(status).toMatchObject({
      budget_id: 'b1',
      category_id: 'c1',
      category_name: 'Supermercado',
      amount: 200000,
      spent: 150000,
      remaining: 50000,
      pct: 75,
      state: 'ok',
    });
  });

  it('muestra en cero un rubro con tope y sin gastos', () => {
    const [status] = buildBudgetStatuses([budget()], new Map());
    expect(status).toMatchObject({ spent: 0, pct: 0, state: 'ok', remaining: 200000 });
  });

  it('ordena por porcentaje consumido, lo más urgente primero', () => {
    const statuses = buildBudgetStatuses(
      [
        budget({ id: 'b1', category_id: 'c1' }),
        budget({ id: 'b2', category_id: 'c2', category: { id: 'c2', name: 'Salidas', color: '#1baf7a' } }),
        budget({ id: 'b3', category_id: 'c3', category: { id: 'c3', name: 'Salud', color: '#e879b0' } }),
      ],
      new Map([
        ['c1', 20000],
        ['c2', 220000],
        ['c3', 170000],
      ]),
    );
    expect(statuses.map((s) => s.budget_id)).toEqual(['b2', 'b3', 'b1']);
    expect(statuses.map((s) => s.state)).toEqual(['exceeded', 'warning', 'ok']);
  });

  it('convierte el amount que Postgres devuelve como string', () => {
    // numeric de Postgres llega como string por supabase-js.
    const [status] = buildBudgetStatuses(
      [budget({ amount: '200000.00' as unknown as number })],
      new Map([['c1', 100000]]),
    );
    expect(status?.amount).toBe(200000);
    expect(status?.pct).toBe(50);
  });

  it('no rompe si el rubro del tope ya no existe', () => {
    const [status] = buildBudgetStatuses([budget({ category: null })], new Map([['c1', 10000]]));
    expect(status?.category_name).toBe('Sin rubro');
  });

  it('devuelve vacío sin topes configurados', () => {
    expect(buildBudgetStatuses([], new Map([['c1', 10000]]))).toEqual([]);
  });
});
