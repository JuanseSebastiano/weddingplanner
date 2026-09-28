import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '@nf/shared';
import {
  buildTrend,
  rowsInMonth,
  savingsRate,
  sortLedger,
  sumAmounts,
  totalsByCategory,
  TREND_MONTHS,
  type CategoryRef,
  type FlowRow,
} from '../server/services/cashflow-math';

function row(date: string, amount: number | string, categoryId: string | null = null): FlowRow {
  return { date, amount, category_id: categoryId };
}

const CATEGORIES: CategoryRef[] = [
  { id: 'cat-sueldo', name: 'Sueldo', color: '#1baf7a' },
  { id: 'cat-freelance', name: 'Freelance', color: '#2a78d6' },
];

describe('sumAmounts', () => {
  it('suma montos que llegan como string desde Postgres', () => {
    // supabase-js devuelve numeric como string: sin la conversión esto
    // concatenaría en vez de sumar.
    expect(sumAmounts([row('2026-07-01', '1500.50'), row('2026-07-02', '2499.50')])).toBe(4000);
  });

  it('devuelve cero sin filas', () => {
    expect(sumAmounts([])).toBe(0);
  });
});

describe('rowsInMonth', () => {
  const rows = [
    row('2026-06-30', 100),
    row('2026-07-01', 200),
    row('2026-07-31', 300),
    row('2026-08-01', 400),
  ];

  it('incluye los bordes del mes y excluye lo de afuera', () => {
    expect(rowsInMonth(rows, '2026-07').map((r) => r.amount)).toEqual([200, 300]);
  });

  it('maneja febrero de un año bisiesto', () => {
    const febrero = [row('2028-02-29', 500), row('2028-03-01', 600)];
    expect(rowsInMonth(febrero, '2028-02').map((r) => r.amount)).toEqual([500]);
  });
});

describe('savingsRate', () => {
  it('calcula qué porcentaje del ingreso no se gastó', () => {
    expect(savingsRate(1000, 750)).toBe(25);
  });

  it('es negativa cuando se gastó más de lo que entró', () => {
    expect(savingsRate(1000, 1300)).toBe(-30);
  });

  it('devuelve null sin ingresos, en vez de dividir por cero', () => {
    expect(savingsRate(0, 500)).toBeNull();
    expect(savingsRate(0, 0)).toBeNull();
  });
});

describe('totalsByCategory', () => {
  it('agrupa por rubro y ordena de mayor a menor', () => {
    const totals = totalsByCategory(
      [
        row('2026-07-01', 1000, 'cat-freelance'),
        row('2026-07-02', 5000, 'cat-sueldo'),
        row('2026-07-03', 500, 'cat-freelance'),
      ],
      CATEGORIES,
    );

    expect(totals.map((t) => [t.category_name, t.total, t.count])).toEqual([
      ['Sueldo', 5000, 1],
      ['Freelance', 1500, 2],
    ]);
  });

  it('junta lo que no tiene rubro bajo "Sin rubro"', () => {
    const totals = totalsByCategory([row('2026-07-01', 800), row('2026-07-02', 200)], CATEGORIES);
    expect(totals).toHaveLength(1);
    expect(totals[0]?.category_name).toBe('Sin rubro');
    expect(totals[0]?.category_id).toBeNull();
    expect(totals[0]?.total).toBe(1000);
  });
});

describe('buildTrend', () => {
  it('devuelve 12 meses terminando en el consultado', () => {
    const trend = buildTrend([], [], '2026-07');
    expect(trend).toHaveLength(TREND_MONTHS);
    expect(trend[0]?.month).toBe('2025-08');
    expect(trend[TREND_MONTHS - 1]?.month).toBe('2026-07');
  });

  it('calcula el neto de cada mes', () => {
    const trend = buildTrend(
      [row('2026-07-05', 900_000), row('2026-06-05', 800_000)],
      [row('2026-07-10', 350_000), row('2026-06-10', 950_000)],
      '2026-07',
    );

    const julio = trend.find((point) => point.month === '2026-07');
    const junio = trend.find((point) => point.month === '2026-06');

    expect(julio).toMatchObject({ income: 900_000, expense: 350_000, net: 550_000 });
    // Neto negativo: se gastó más de lo que entró.
    expect(junio).toMatchObject({ income: 800_000, expense: 950_000, net: -150_000 });
  });

  it('deja en cero los meses sin movimientos en vez de saltearlos', () => {
    const trend = buildTrend([row('2026-07-01', 100)], [], '2026-07');
    const vacio = trend.find((point) => point.month === '2026-03');
    expect(vacio).toMatchObject({ income: 0, expense: 0, net: 0 });
  });

  it('ignora lo que cae fuera de la ventana', () => {
    const trend = buildTrend([row('2020-01-01', 999_999)], [], '2026-07');
    expect(trend.every((point) => point.income === 0)).toBe(true);
  });
});

describe('sortLedger', () => {
  function entry(id: string, date: string, createdAt: string, kind: 'income' | 'expense'): LedgerEntry {
    return {
      id,
      kind,
      date,
      amount: 100,
      currency: 'ARS',
      counterparty: null,
      description: null,
      category: null,
      account: null,
      profile: null,
      created_at: createdAt,
    };
  }

  it('ordena por fecha del movimiento, más reciente primero', () => {
    const sorted = sortLedger([
      entry('a', '2026-07-01', '2026-07-01T10:00:00Z', 'expense'),
      entry('b', '2026-07-15', '2026-07-15T10:00:00Z', 'income'),
      entry('c', '2026-07-08', '2026-07-08T10:00:00Z', 'expense'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('ante la misma fecha desempata por el cargado más recientemente', () => {
    // Sin este desempate, el orden de dos movimientos del mismo día
    // dependería de en qué tabla cayó cada uno.
    const sorted = sortLedger([
      entry('viejo', '2026-07-10', '2026-07-10T08:00:00Z', 'expense'),
      entry('nuevo', '2026-07-10', '2026-07-10T20:00:00Z', 'income'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['nuevo', 'viejo']);
  });

  it('no muta el arreglo original', () => {
    const original = [
      entry('a', '2026-07-01', '2026-07-01T10:00:00Z', 'expense'),
      entry('b', '2026-07-15', '2026-07-15T10:00:00Z', 'income'),
    ];
    sortLedger(original);
    expect(original.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
