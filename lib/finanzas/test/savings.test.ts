import { describe, expect, it } from 'vitest';
import {
  investmentAmount,
  mergePosition,
  summarizeCash,
  type MovementRow,
} from '../server/services/savings-math';

const deposit = (amount: number, moved_at = '2026-08-03'): MovementRow => ({
  kind: 'deposit',
  amount,
  moved_at,
});
const withdrawal = (amount: number, moved_at = '2026-08-03'): MovementRow => ({
  kind: 'withdrawal',
  amount,
  moved_at,
});
const investment = (amount: number, moved_at = '2026-08-03'): MovementRow => ({
  kind: 'investment',
  amount,
  moved_at,
});

describe('summarizeCash', () => {
  it('la caja vacía es todo cero', () => {
    expect(summarizeCash([], '2026-08')).toEqual({
      available: 0,
      deposited: 0,
      withdrawn: 0,
      invested: 0,
      deposited_this_month: 0,
    });
  });

  it('el disponible es depósitos menos retiros menos inversiones', () => {
    const cash = summarizeCash(
      [deposit(300000), deposit(200000), withdrawal(50000), investment(120000)],
      '2026-08',
    );
    expect(cash).toEqual({
      available: 330000,
      deposited: 500000,
      withdrawn: 50000,
      invested: 120000,
      deposited_this_month: 500000,
    });
  });

  it('solo cuenta como "del mes" los depósitos de ese mes', () => {
    const cash = summarizeCash(
      [deposit(100000, '2026-07-20'), deposit(250000, '2026-08-01'), deposit(50000, '2026-08-30')],
      '2026-08',
    );
    expect(cash.deposited).toBe(400000);
    expect(cash.deposited_this_month).toBe(300000);
  });

  it('un retiro del mes no descuenta de lo apartado en el mes', () => {
    // "Cuánto aparté este mes" y "cuánto queda en la caja" son dos
    // preguntas distintas: el retiro contesta la segunda, no la primera.
    const cash = summarizeCash([deposit(200000), withdrawal(80000)], '2026-08');
    expect(cash.deposited_this_month).toBe(200000);
    expect(cash.available).toBe(120000);
  });

  it('convierte los numeric que Postgres devuelve como string', () => {
    const cash = summarizeCash(
      [
        { kind: 'deposit', amount: '150000.50', moved_at: '2026-08-02' },
        { kind: 'investment', amount: '50000.25', moved_at: '2026-08-04' },
      ],
      '2026-08',
    );
    expect(cash.available).toBe(100000.25);
  });

  it('ignora una fila con monto ilegible en vez de contagiar NaN al saldo', () => {
    const cash = summarizeCash(
      [deposit(100000), { kind: 'deposit', amount: 'x', moved_at: '2026-08-02' }],
      '2026-08',
    );
    expect(cash.available).toBe(100000);
  });

  it('no arrastra el error de punto flotante al saldo', () => {
    const cash = summarizeCash([deposit(0.1), deposit(0.2)], '2026-08');
    expect(cash.available).toBe(0.3);
  });
});

describe('investmentAmount', () => {
  it('es cantidad por precio', () => {
    expect(investmentAmount(10, 21000)).toBe(210000);
  });

  it('redondea a dos decimales', () => {
    expect(investmentAmount(3, 1000.333)).toBe(3001);
  });
});

describe('mergePosition', () => {
  it('la primera compra fija cantidad y costo', () => {
    expect(mergePosition(null, 10, 18500)).toEqual({ quantity: 10, avg_cost: 18500 });
  });

  it('promedia ponderado al comprar más caro', () => {
    // 10 a 200 + 10 a 100 = 20 a 150, no 20 a 100.
    expect(mergePosition({ quantity: 10, avg_cost: 200 }, 10, 100)).toEqual({
      quantity: 20,
      avg_cost: 150,
    });
  });

  it('pondera por cantidad y no por operación', () => {
    // 90 a 100 + 10 a 200 se acerca a 100, no a 150.
    expect(mergePosition({ quantity: 90, avg_cost: 100 }, 10, 200)).toEqual({
      quantity: 100,
      avg_cost: 110,
    });
  });

  it('admite fracciones de CEDEAR', () => {
    const merged = mergePosition({ quantity: 1.5, avg_cost: 1000 }, 0.5, 2000);
    expect(merged.quantity).toBe(2);
    expect(merged.avg_cost).toBe(1250);
  });

  it('trata una posición en cero como si no existiera', () => {
    expect(mergePosition({ quantity: 0, avg_cost: 999 }, 5, 100)).toEqual({
      quantity: 5,
      avg_cost: 100,
    });
  });

  it('el costo total se conserva después de fusionar', () => {
    const before = 10 * 18500 + 7 * 22300;
    const merged = mergePosition({ quantity: 10, avg_cost: 18500 }, 7, 22300);
    expect(merged.quantity * merged.avg_cost).toBeCloseTo(before, 0);
  });
});
