import { monthBounds } from '@nf/shared';

/** Vencimiento de un pago fijo en el mes YYYY-MM; el 31 cae el último día en meses cortos. */
export function dueDate(month: string, dueDay: number): string {
  const last = Number(monthBounds(month).end.slice(8));
  return `${month}-${String(Math.min(dueDay, last)).padStart(2, '0')}`;
}
