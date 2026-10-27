/**
 * Lógica pura del cash flow proyectado: ingreso del último mes cerrado,
 * gasto promedio de los meses base y
 * pagos programados de boda y viaje repartidos por mes. Sin base de datos.
 */
import { addMonths, type CashflowProjection, type Commitment, type ProjectionMonth } from '@nf/shared';
import { round2, rowsInMonth, sumAmounts, type FlowRow } from './cashflow-math';

export const BASE_MONTHS = 3;
export const MIN_HORIZON = 6;

/** Meses cerrados anteriores a `month`, del más viejo al más nuevo. */
export function baseMonths(month: string): string[] {
  const months: string[] = [];
  for (let i = BASE_MONTHS; i >= 1; i -= 1) months.push(addMonths(month, -i));
  return months;
}

/** Promedio mensual: los meses sin movimientos cuentan como cero. */
export function monthlyAverage(rows: FlowRow[], months: string[]): number {
  return round2(months.reduce((acc, m) => acc + sumAmounts(rowsInMonth(rows, m)), 0) / months.length);
}

export interface ProjectionInput {
  /** Mes actual, YYYY-MM: primer mes proyectado. */
  month: string;
  /** Ingresos y gastos ya llevados a pesos. */
  incomes: FlowRow[];
  expenses: FlowRow[];
  /** Pagos impagos de boda y viaje. */
  commitments: Commitment[];
  /** Pesos por dólar para lo que no trae cotización propia. */
  rate: number | null;
  saldo_inicial: number;
}

export function buildProjection(input: ProjectionInput): CashflowProjection {
  const { month, rate } = input;
  const base = baseMonths(month);
  // El ingreso se toma del último mes cerrado, no del promedio.
  const incomeAvg = monthlyAverage(input.incomes, base.slice(-1));
  const expenseAvg = monthlyAverage(input.expenses, base);

  const toArs = (c: Commitment) => (c.currency === 'ARS' ? c.amount : c.amount * (c.fx_rate ?? rate ?? 0));

  const sinFecha = { boda: 0, viaje: 0 };
  const porMes = new Map<string, { boda: number; viaje: number }>();
  let last = addMonths(month, MIN_HORIZON - 1);
  for (const c of input.commitments) {
    if (c.source === 'tarjeta') continue;
    if (!c.due_date) {
      sinFecha[c.source] += toArs(c);
      continue;
    }
    // Lo vencido e impago se tiene que pagar ya: cae en el mes actual.
    const m = c.due_date.slice(0, 7) < month ? month : c.due_date.slice(0, 7);
    if (m > last) last = m;
    const entry = porMes.get(m) ?? { boda: 0, viaje: 0 };
    entry[c.source] += toArs(c);
    porMes.set(m, entry);
  }

  const months: ProjectionMonth[] = [];
  let balance = input.saldo_inicial;
  for (let m = month; m <= last; m = addMonths(m, 1)) {
    const pagos = porMes.get(m) ?? { boda: 0, viaje: 0 };
    const expense = expenseAvg + pagos.boda + pagos.viaje;
    const net = incomeAvg - expense;
    balance += net;
    months.push({
      month: m,
      income: incomeAvg,
      living: expenseAvg,
      boda: round2(pagos.boda),
      viaje: round2(pagos.viaje),
      expense: round2(expense),
      net: round2(net),
      balance: round2(balance),
    });
  }

  return {
    base_months: base,
    income_avg: incomeAvg,
    expense_avg: expenseAvg,
    saldo_inicial: round2(input.saldo_inicial),
    cotizacion: rate,
    months,
    sin_fecha: { boda: round2(sinFecha.boda), viaje: round2(sinFecha.viaje) },
  };
}
