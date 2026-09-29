import type { SavingsCash, SavingsMovementKind } from '@nf/shared';

/**
 * Saldo de la caja de ahorro y fusión de posiciones, sin nada de I/O.
 *
 * Mismo criterio que portfolio-math y budget-math: las reglas que definen
 * cuánta plata hay se testean sin base de datos.
 */

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface MovementRow {
  kind: SavingsMovementKind;
  /** numeric de Postgres llega como string por supabase-js. */
  amount: number | string;
  /** Formato YYYY-MM-DD. */
  moved_at: string;
}

/**
 * Estado de la caja: cuánta plata entró, cuánta salió, cuánta se invirtió
 * y cuánta queda sin invertir.
 *
 * El disponible se calcula siempre desde los movimientos y no se guarda en
 * ninguna columna: un saldo materializado es un saldo que en algún momento
 * se desincroniza.
 */
export function summarizeCash(rows: MovementRow[], month: string): SavingsCash {
  let deposited = 0;
  let withdrawn = 0;
  let invested = 0;
  let depositedThisMonth = 0;

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;

    if (row.kind === 'deposit') {
      deposited += amount;
      if (row.moved_at.slice(0, 7) === month) depositedThisMonth += amount;
    } else if (row.kind === 'withdrawal') {
      withdrawn += amount;
    } else {
      invested += amount;
    }
  }

  return {
    available: round2(deposited - withdrawn - invested),
    deposited: round2(deposited),
    withdrawn: round2(withdrawn),
    invested: round2(invested),
    deposited_this_month: round2(depositedThisMonth),
  };
}

/** Lo que cuesta una compra: cantidad por precio unitario. */
export function investmentAmount(quantity: number, price: number): number {
  return round2(quantity * price);
}

export interface Position {
  quantity: number;
  avg_cost: number;
}

/**
 * Suma una compra a una posición existente, recalculando el costo promedio
 * ponderado.
 *
 * Es la cuenta que hasta ahora había que hacer a mano antes de editar una
 * tenencia (el formulario avisaba "recalculá vos el costo promedio"):
 * comprar 10 a $100 teniendo 10 a $200 deja 20 a $150, no 20 a $100.
 */
export function mergePosition(existing: Position | null, quantity: number, price: number): Position {
  if (!existing || existing.quantity <= 0) {
    return { quantity: round6(quantity), avg_cost: round2(price) };
  }

  const totalQuantity = existing.quantity + quantity;
  const totalCost = existing.quantity * existing.avg_cost + quantity * price;

  return {
    quantity: round6(totalQuantity),
    avg_cost: round2(totalCost / totalQuantity),
  };
}

/** La cantidad admite fracciones de CEDEAR: numeric(18,6) en la base. */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
