import { describe, expect, it } from 'vitest';
import { dueDate } from '../server/services/bills-math';

describe('dueDate', () => {
  it('arma la fecha del mes', () => {
    expect(dueDate('2026-11', 1)).toBe('2026-11-01');
  });
  it('ajusta el día a meses cortos', () => {
    expect(dueDate('2027-02', 31)).toBe('2027-02-28');
    expect(dueDate('2026-11', 31)).toBe('2026-11-30');
  });
});
