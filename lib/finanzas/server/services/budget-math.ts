import {
  BUDGET_WARN_RATIO,
  type BudgetState,
  type MonthlyPlan,
  type MonthlyPlanRubro,
  type BudgetStatus,
  type BudgetWithCategory,
} from '@nf/shared';

/**
 * Comparación de lo gastado contra el tope, sin nada de I/O.
 *
 * Vive aparte de budgets.ts por lo mismo que portfolio-math.ts y
 * cashflow-math.ts: son las reglas que definen cuándo la app avisa, y
 * conviene poder testearlas sin base de datos.
 */

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Porcentaje del tope consumido. Puede pasar de 100 — es justamente el
 * caso que hay que mostrar.
 *
 * Un tope de cero o negativo no debería existir (la base lo prohíbe con
 * un check y la API lo valida), pero si llegara igual devolvemos 0 en vez
 * de Infinity o NaN: un número raro en pantalla es peor que un cero.
 */
export function budgetPct(spent: number, amount: number): number {
  if (amount <= 0) return 0;
  return round2((spent / amount) * 100);
}

/**
 * En qué estado está el rubro.
 *
 * Gastar exactamente el tope todavía no es pasarse: `exceeded` es
 * estrictamente mayor. El aviso arranca en BUDGET_WARN_RATIO del tope.
 */
export function budgetState(spent: number, amount: number): BudgetState {
  if (amount <= 0) return 'ok';
  if (spent > amount) return 'exceeded';
  if (spent >= amount * BUDGET_WARN_RATIO) return 'warning';
  return 'ok';
}

export interface BudgetProgress {
  spent: number;
  remaining: number;
  pct: number;
  state: BudgetState;
}

/** Todo lo derivado de un par (gastado, tope), en una sola pasada. */
export function describeBudget(spent: number, amount: number): BudgetProgress {
  return {
    spent: round2(spent),
    remaining: round2(amount - spent),
    pct: budgetPct(spent, amount),
    state: budgetState(spent, amount),
  };
}

/** ¿Hay algo que amerite avisar? Lo usa el banner del dashboard. */
export function needsAttention(state: BudgetState): boolean {
  return state === 'warning' || state === 'exceeded';
}

const UNCATEGORIZED_COLOR = '#94a3b8';

/**
 * Cruza los topes con lo gastado por rubro en un mes.
 *
 * `spentByCategory` lo arma quien ya tenga los gastos del mes en memoria
 * — hoy el dashboard, que los necesita igual para el desglose — para no
 * volver a pedirle a la base lo mismo dos veces.
 *
 * Un rubro con tope y sin gastos aparece igual, en cero: saber que
 * todavía no se tocó el presupuesto es información, no ausencia de ella.
 */
export function buildBudgetStatuses(
  budgets: BudgetWithCategory[],
  spentByCategory: Map<string, number>,
): BudgetStatus[] {
  return budgets
    .map((budget) => {
      // numeric de Postgres llega como string por supabase-js.
      const amount = Number(budget.amount);
      const progress = describeBudget(spentByCategory.get(budget.category_id) ?? 0, amount);
      return {
        budget_id: budget.id,
        category_id: budget.category_id,
        category_name: budget.category?.name ?? 'Sin rubro',
        color: budget.category?.color ?? UNCATEGORIZED_COLOR,
        amount,
        ...progress,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

export type PlanRubroInput = Omit<MonthlyPlanRubro, 'cut' | 'adjusted' | 'remaining' | 'state'>;

/**
 * Presupuesto mensual del hogar. Lo que cada rubro gasta por encima de su
 * tope (o todo lo de un rubro sin tope) es exceso, y se descuenta de los
 * rubros variables en proporción a su tope, sin pasar de lo que les queda
 * disponible. Lo que no entra queda como `uncovered`.
 */
export function buildMonthlyPlan(month: string, cap: number | null, rubros: PlanRubroInput[]): MonthlyPlan {
  const excess = rubros.reduce((acc, r) => acc + Math.max(0, r.spent - r.amount), 0);
  const cut = new Map<PlanRubroInput, number>();
  let pendiente = excess;

  // Reparto proporcional; si un variable se queda sin disponible, lo que no
  // le entra se reparte entre los que todavía tienen.
  for (let vuelta = 0; vuelta < rubros.length && pendiente > 0.005; vuelta += 1) {
    const conLugar = rubros.filter((r) => r.variable && r.amount - r.spent - (cut.get(r) ?? 0) > 0.005);
    const base = conLugar.reduce((acc, r) => acc + r.amount, 0);
    if (base <= 0) break;
    let repartido = 0;
    for (const r of conLugar) {
      const disponible = r.amount - r.spent - (cut.get(r) ?? 0);
      const parte = Math.min(disponible, (pendiente * r.amount) / base);
      cut.set(r, (cut.get(r) ?? 0) + parte);
      repartido += parte;
    }
    pendiente -= repartido;
  }

  const assigned = rubros.reduce((acc, r) => acc + r.amount, 0);
  return {
    month,
    cap,
    assigned: round2(assigned),
    unassigned: cap === null ? null : round2(cap - assigned),
    spent: round2(rubros.reduce((acc, r) => acc + r.spent, 0)),
    excess: round2(excess),
    uncovered: round2(Math.max(0, pendiente)),
    rubros: rubros.map((r) => {
      const recorte = round2(cut.get(r) ?? 0);
      const adjusted = round2(r.amount - recorte);
      return {
        ...r,
        cut: recorte,
        adjusted,
        remaining: round2(adjusted - r.spent),
        state: budgetState(r.spent, adjusted),
      };
    }),
  };
}
