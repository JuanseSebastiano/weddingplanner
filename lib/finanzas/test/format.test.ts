import { describe, expect, it } from 'vitest';
import { addMonths, currentMonth, monthBounds, parseAmount } from '@nf/shared';

describe('parseAmount', () => {
  it('interpreta el punto como separador de miles (formato AR)', () => {
    expect(parseAmount('$ 45.300,50')).toBe(45300.5);
    expect(parseAmount('1.234.567,89')).toBe(1234567.89);
  });

  it('interpreta el formato con punto decimal', () => {
    expect(parseAmount('1234.56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('acepta enteros sin separadores', () => {
    expect(parseAmount('1500')).toBe(1500);
  });

  it('devuelve null si no hay número', () => {
    expect(parseAmount('sin monto')).toBeNull();
  });
});

describe('helpers de mes', () => {
  it('calcula los límites del mes', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2024-02').end).toBe('2024-02-29');
  });

  it('suma y resta meses cruzando el año', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('formatea el mes actual como YYYY-MM', () => {
    expect(currentMonth(new Date(2026, 6, 26))).toBe('2026-07');
  });
});
