import { currentMonth, monthBounds, type CashflowProjection, type Commitment } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { getPortfolioSummary } from './portfolio';
import { toNumber, type FlowRow } from './cashflow-math';
import { baseMonths, buildProjection } from './projection-math';

interface MovementRow {
  amount: number | string;
  currency: 'ARS' | 'USD';
  fx_rate: number | string | null;
  category_id: string | null;
}

/**
 * Cash flow proyectado de la pareja: ingresos y gastos estimados con el
 * promedio de los últimos meses cerrados, más los pagos programados de la
 * boda y del viaje. El saldo arranca del ahorro actual, como en Presupuesto.
 */
export async function getCashflowProjection(coupleId: string): Promise<CashflowProjection> {
  const month = currentMonth();
  const base = baseMonths(month);
  const from = monthBounds(base[0]).start;
  const to = monthBounds(base[base.length - 1]).end;

  const [incomesRes, expensesRes, compromisosRes, weddingRes, portfolio] = await Promise.all([
    supabaseAdmin
      .from('fin_incomes')
      .select('amount, currency, fx_rate, category_id, income_date')
      .eq('couple_id', coupleId)
      .gte('income_date', from)
      .lte('income_date', to),
    supabaseAdmin
      .from('fin_expenses')
      .select('amount, currency, fx_rate, category_id, expense_date')
      .eq('couple_id', coupleId)
      .eq('status', 'confirmed')
      .gte('expense_date', from)
      .lte('expense_date', to),
    supabaseAdmin
      .from('fin_commitments')
      .select('source, ref_id, due_date, amount, currency, fx_rate, label, href')
      .eq('couple_id', coupleId)
      .in('source', ['boda', 'viaje']),
    supabaseAdmin.from('wedding_info').select('cotizacion_referencia').eq('couple_id', coupleId).maybeSingle(),
    getPortfolioSummary(coupleId),
  ]);
  for (const res of [incomesRes, expensesRes, compromisosRes, weddingRes]) {
    if (res.error) throw res.error;
  }

  const rate = portfolio.fx?.rate ?? (Number(weddingRes.data?.cotizacion_referencia ?? 0) || null);
  const toFlow = (row: MovementRow, date: string): FlowRow => ({
    date,
    category_id: row.category_id,
    amount:
      row.currency === 'ARS'
        ? toNumber(row.amount)
        : toNumber(row.amount) * (row.fx_rate === null ? (rate ?? 0) : toNumber(row.fx_rate)),
  });

  return buildProjection({
    month,
    incomes: ((incomesRes.data ?? []) as Array<MovementRow & { income_date: string }>).map((row) =>
      toFlow(row, row.income_date),
    ),
    expenses: ((expensesRes.data ?? []) as Array<MovementRow & { expense_date: string }>).map((row) =>
      toFlow(row, row.expense_date),
    ),
    commitments: (compromisosRes.data ?? []).map(
      (row): Commitment => ({
        source: row.source,
        ref_id: row.ref_id,
        due_date: row.due_date,
        amount: Number(row.amount),
        currency: row.currency,
        fx_rate: row.fx_rate === null ? null : Number(row.fx_rate),
        label: row.label,
        href: row.href,
      }),
    ),
    rate,
    saldo_inicial: portfolio.total_savings,
  });
}
