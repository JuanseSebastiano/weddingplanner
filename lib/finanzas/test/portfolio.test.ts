import { describe, expect, it } from 'vitest';
import {
  costBasis,
  gain,
  gainPct,
  marketValue,
  summarizePositions,
  type PositionInput,
} from '../server/services/portfolio-math';
import { parseQuotes } from '../server/services/market-data';
import { parseFxRate } from '../server/services/fx-rate';

function position(overrides: Partial<PositionInput> = {}): PositionInput {
  return { quantity: 10, avg_cost: 1000, price: 1200, ...overrides };
}

describe('costBasis', () => {
  it('multiplica cantidad por costo promedio', () => {
    expect(costBasis(position({ quantity: 10, avg_cost: 1500.5 }))).toBe(15005);
  });
});

describe('marketValue', () => {
  it('multiplica cantidad por precio actual', () => {
    expect(marketValue(position({ quantity: 10, price: 1200 }))).toBe(12000);
  });

  it('devuelve null sin cotización, en vez de asumir el costo', () => {
    expect(marketValue(position({ price: null }))).toBeNull();
  });
});

describe('gain', () => {
  it('es la diferencia entre valor de mercado y costo', () => {
    // costo 10.000, valor 12.000 -> ganancia 2.000
    expect(gain(position({ quantity: 10, avg_cost: 1000, price: 1200 }))).toBe(2000);
  });

  it('puede ser negativa', () => {
    expect(gain(position({ quantity: 10, avg_cost: 1500, price: 1200 }))).toBe(-3000);
  });

  it('es null sin cotización', () => {
    expect(gain(position({ price: null }))).toBeNull();
  });
});

describe('gainPct', () => {
  it('calcula el porcentaje sobre el costo', () => {
    expect(gainPct(position({ quantity: 10, avg_cost: 1000, price: 1200 }))).toBe(20);
  });

  it('es null sin cotización', () => {
    expect(gainPct(position({ price: null }))).toBeNull();
  });

  it('es null si el costo es cero, no Infinity', () => {
    expect(gainPct(position({ quantity: 0, avg_cost: 0, price: 100 }))).toBeNull();
  });
});

describe('summarizePositions', () => {
  it('suma el costo de todas las posiciones, tengan cotización o no', () => {
    const totals = summarizePositions([
      { cost_basis: 10_000, market_value: 12_000, gain: 2000 },
      { cost_basis: 5_000, market_value: null, gain: null },
    ]);
    expect(totals.total_cost_basis).toBe(15_000);
  });

  it('el valor de mercado y la ganancia solo consideran lo cotizado', () => {
    const totals = summarizePositions([
      { cost_basis: 10_000, market_value: 12_000, gain: 2_000 },
      { cost_basis: 5_000, market_value: null, gain: null },
    ]);
    // No mezcla el costo de la posición sin cotizar (5.000) con el valor
    // de mercado de la otra: sería un número que no representa nada.
    expect(totals.total_market_value).toBe(12_000);
    expect(totals.total_gain).toBe(2_000);
    expect(totals.total_gain_pct).toBe(20);
  });

  it('devuelve todo en null si ninguna posición tiene cotización', () => {
    const totals = summarizePositions([{ cost_basis: 10_000, market_value: null, gain: null }]);
    expect(totals.total_market_value).toBeNull();
    expect(totals.total_gain).toBeNull();
    expect(totals.total_gain_pct).toBeNull();
    expect(totals.total_cost_basis).toBe(10_000);
  });

  it('sin posiciones no rompe', () => {
    expect(summarizePositions([])).toEqual({
      total_cost_basis: 0,
      total_market_value: null,
      total_gain: null,
      total_gain_pct: null,
    });
  });
});

describe('parseQuotes', () => {
  it('interpreta filas bien formadas', () => {
    const quotes = parseQuotes([
      { symbol: 'aapl', c: 1234.5, pct_change: 1.2 },
      { symbol: 'MELI', c: 98765, pct_change: -0.5 },
    ]);
    expect(quotes.get('AAPL')).toEqual({ ticker: 'AAPL', price: 1234.5, change_pct: 1.2 });
    expect(quotes.get('MELI')).toEqual({ ticker: 'MELI', price: 98765, change_pct: -0.5 });
  });

  it('descarta filas sin symbol en vez de romper el resto', () => {
    const quotes = parseQuotes([{ c: 100 }, { symbol: 'KO', c: 500 }]);
    expect(quotes.size).toBe(1);
    expect(quotes.get('KO')).toBeTruthy();
  });

  it('acepta precio null explícito de la fuente', () => {
    const quotes = parseQuotes([{ symbol: 'GGAL', c: null }]);
    expect(quotes.get('GGAL')).toEqual({ ticker: 'GGAL', price: null, change_pct: null });
  });

  it('devuelve un mapa vacío si la respuesta no es un arreglo', () => {
    // Esto es lo que pasaría si la fuente cambiara de forma por completo
    // (ver el comentario en market-data.ts): degrada en vez de romper.
    expect(parseQuotes({ error: 'no autorizado' }).size).toBe(0);
    expect(parseQuotes(null).size).toBe(0);
  });

  it('ignora campos extra que no forman parte del contrato asumido', () => {
    const quotes = parseQuotes([{ symbol: 'YPFD', c: 30000, volumen_extra: 999, moneda: 'ARS' }]);
    expect(quotes.get('YPFD')).toEqual({ ticker: 'YPFD', price: 30000, change_pct: null });
  });
});

describe('parseFxRate', () => {
  it('interpreta una respuesta bien formada', () => {
    const rate = parseFxRate({
      casa: 'contadoconliqui',
      nombre: 'Contado con Liquidación',
      compra: 1230,
      venta: 1250.5,
      fechaActualizacion: '2026-07-30T10:00:00Z',
    });
    expect(rate).toEqual({ rate: 1250.5, source: 'CCL', updated_at: '2026-07-30T10:00:00Z' });
  });

  it('usa el lado venta, no el de compra', () => {
    // Comprar dólares hoy cuesta el "venta": es el número que refleja lo
    // que costaría reponer la tenencia, no lo que te darían por venderla.
    const rate = parseFxRate({ compra: 1000, venta: 1050 });
    expect(rate?.rate).toBe(1050);
  });

  it('devuelve null si falta el campo venta', () => {
    expect(parseFxRate({ casa: 'contadoconliqui', compra: 1230 })).toBeNull();
  });

  it('devuelve null ante una respuesta completamente distinta', () => {
    // Mismo criterio que parseQuotes: si la fuente cambió de forma, se
    // degrada en vez de inventar un número.
    expect(parseFxRate({ error: 'no encontrado' })).toBeNull();
    expect(parseFxRate(null)).toBeNull();
    expect(parseFxRate([1, 2, 3])).toBeNull();
  });

  it('usa la fecha actual si la fuente no informa fechaActualizacion', () => {
    const rate = parseFxRate({ venta: 1200 });
    expect(rate?.rate).toBe(1200);
    expect(rate?.updated_at).toBeTruthy();
  });
});
