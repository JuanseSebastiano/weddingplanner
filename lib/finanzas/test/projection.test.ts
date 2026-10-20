import { describe, expect, it } from 'vitest';
import type { Commitment } from '@nf/shared';
import { baseMonths, buildProjection, MIN_HORIZON, monthlyAverage } from '../server/services/projection-math';
import type { FlowRow } from '../server/services/cashflow-math';

function row(date: string, amount: number | string): FlowRow {
  return { date, amount, category_id: null };
}

function pago(source: 'boda' | 'viaje', due_date: string | null, amount: number, currency: 'ARS' | 'USD' = 'ARS', fx_rate: number | null = null): Commitment {
  return { source, ref_id: `${source}-${due_date}-${amount}`, due_date, amount, currency, fx_rate, label: 'x', href: '/' };
}

describe('baseMonths', () => {
  it('devuelve los 3 meses cerrados anteriores', () => {
    expect(baseMonths('2026-01')).toEqual(['2025-10', '2025-11', '2025-12']);
  });
});

describe('monthlyAverage', () => {
  it('cuenta los meses vacíos como cero', () => {
    const rows = [row('2026-07-10', 300), row('2026-08-05', '600'), row('2026-10-01', 9999)];
    expect(monthlyAverage(rows, ['2026-07', '2026-08', '2026-09'])).toBe(300);
  });
});

describe('buildProjection', () => {
  const base = {
    month: '2026-10',
    incomes: [row('2026-07-01', 1000), row('2026-08-01', 1000), row('2026-09-01', 1000)],
    expenses: [row('2026-07-01', 600), row('2026-08-01', 600), row('2026-09-01', 600)],
    rate: 1000,
    saldo_inicial: 500,
  };

  it('proyecta al menos MIN_HORIZON meses con saldo acumulado', () => {
    const p = buildProjection({ ...base, commitments: [] });
    expect(p.income_avg).toBe(1000);
    expect(p.expense_avg).toBe(600);
    expect(p.months).toHaveLength(MIN_HORIZON);
    expect(p.months[0]).toMatchObject({ month: '2026-10', net: 400, balance: 900 });
    expect(p.months[MIN_HORIZON - 1].balance).toBe(500 + 400 * MIN_HORIZON);
  });

  it('reparte los pagos por mes, lleva los vencidos al actual y extiende el horizonte', () => {
    const p = buildProjection({
      ...base,
      commitments: [
        pago('boda', '2026-08-15', 200),
        pago('boda', '2026-10-20', 100),
        pago('viaje', '2027-06-01', 2, 'USD'),
        pago('viaje', '2027-06-10', 1, 'USD', 1500),
      ],
    });
    expect(p.months[0]).toMatchObject({ boda: 300, expense: 900, net: 100 });
    expect(p.months.at(-1)).toMatchObject({ month: '2027-06', viaje: 3500 });
  });

  it('deja aparte los pagos sin fecha y saltea tarjetas', () => {
    const tarjeta = { ...pago('boda', '2026-11-01', 999), source: 'tarjeta' as const };
    const p = buildProjection({ ...base, commitments: [pago('boda', null, 50), pago('viaje', null, 1, 'USD'), tarjeta] });
    expect(p.sin_fecha).toEqual({ boda: 50, viaje: 1000 });
    expect(p.months.every((m) => m.boda === 0 && m.viaje === 0)).toBe(true);
  });
});
