import type { HoldingPosition, PortfolioSummary } from '@nf/shared';
import { listHoldings } from './holdings';
import { getUsdRate } from './fx-rate';
import { getQuotes, quoteFor } from './market-data';
import { costBasis, gain, gainPct, marketValue, round2, summarizePositions } from './portfolio-math';
import { getCash } from './savings';

/**
 * Tenencias del hogar con cotización y cálculos resueltos.
 *
 * Se ven las posiciones de los dos, cada uno administra solo la suya (ver
 * holdings.ts) — mismo modelo de lectura consolidada que el resto de la app.
 * Los montos siempre viajan en pesos; la conversión a USD para el toggle
 * de la UI se hace en el frontend con `fx.rate`, así no hay que duplicar
 * cada campo monetario en las dos monedas.
 */
export async function getPortfolioSummary(coupleId: string): Promise<PortfolioSummary> {
  const [holdings, { quotes, asOf }, fx, cash] = await Promise.all([
    listHoldings(coupleId),
    getQuotes(),
    getUsdRate(),
    getCash(coupleId),
  ]);

  const positions: HoldingPosition[] = holdings.map((holding) => {
    const quote = quoteFor(quotes, holding.ticker);
    const input = { quantity: holding.quantity, avg_cost: holding.avg_cost, price: quote?.price ?? null };
    return {
      ...holding,
      quote,
      cost_basis: costBasis(input),
      market_value: marketValue(input),
      gain: gain(input),
      gain_pct: gainPct(input),
    };
  });

  const totals = summarizePositions(positions);

  // Sin cotización el valor de mercado es null, pero el ahorro total no
  // puede quedar en null por eso: se cae al costo, que es un piso honesto.
  const invested = totals.total_market_value ?? totals.total_cost_basis;

  return {
    positions,
    ...totals,
    quoted_at: asOf,
    quotes_available: quotes.size > 0,
    fx,
    cash,
    total_savings: round2(invested + cash.available),
  };
}
