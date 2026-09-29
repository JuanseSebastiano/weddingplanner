/**
 * Lógica pura de la cartera: costo, valor de mercado y ganancia de una
 * posición, sin acceso a red ni a base de datos. Es lo único de la sección
 * Ahorros que se puede testear con certeza — la cotización en sí depende
 * de una fuente externa que no está bajo control de esta app (ver
 * `market-data.ts`).
 */

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PositionInput {
  quantity: number;
  avg_cost: number;
  /** Precio actual por unidad. Null si la fuente no cotiza el ticker. */
  price: number | null;
}

export function costBasis(position: PositionInput): number {
  return round2(position.quantity * position.avg_cost);
}

export function marketValue(position: PositionInput): number | null {
  if (position.price === null) return null;
  return round2(position.quantity * position.price);
}

export function gain(position: PositionInput): number | null {
  const value = marketValue(position);
  if (value === null) return null;
  return round2(value - costBasis(position));
}

/** Null también si el costo es cero: no hay denominador que signifique algo. */
export function gainPct(position: PositionInput): number | null {
  const g = gain(position);
  const basis = costBasis(position);
  if (g === null || basis <= 0) return null;
  return round2((g / basis) * 100);
}

export interface PositionMath {
  cost_basis: number;
  market_value: number | null;
  gain: number | null;
}

export interface PortfolioTotals {
  total_cost_basis: number;
  total_market_value: number | null;
  total_gain: number | null;
  total_gain_pct: number | null;
}

/**
 * Agrega los totales de la cartera.
 *
 * El costo total suma TODAS las posiciones, tengan cotización o no — es lo
 * único que siempre se puede mostrar. El valor de mercado y la ganancia
 * solo consideran las posiciones cotizadas: mezclar el costo de una
 * posición sin cotizar con el valor de mercado de las demás daría un
 * número que no significa nada.
 */
export function summarizePositions(positions: PositionMath[]): PortfolioTotals {
  const totalCostBasis = round2(positions.reduce((sum, p) => sum + p.cost_basis, 0));

  const priced = positions.filter(
    (p): p is PositionMath & { market_value: number; gain: number } =>
      p.market_value !== null && p.gain !== null,
  );

  if (priced.length === 0) {
    return {
      total_cost_basis: totalCostBasis,
      total_market_value: null,
      total_gain: null,
      total_gain_pct: null,
    };
  }

  const totalMarketValue = round2(priced.reduce((sum, p) => sum + p.market_value, 0));
  const totalGain = round2(priced.reduce((sum, p) => sum + p.gain, 0));
  const pricedCostBasis = priced.reduce((sum, p) => sum + p.cost_basis, 0);

  return {
    total_cost_basis: totalCostBasis,
    total_market_value: totalMarketValue,
    total_gain: totalGain,
    total_gain_pct: pricedCostBasis > 0 ? round2((totalGain / pricedCostBasis) * 100) : null,
  };
}
