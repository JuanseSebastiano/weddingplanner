import { z } from 'zod';
import type { Quote } from '@nf/shared';

/**
 * Fuente de cotizaciones de CEDEARs.
 *
 * Balanz no tiene API pública para leer la cartera de un cliente, así que
 * la tenencia se carga a mano (ver `holdings.ts`) y solo el PRECIO se
 * resuelve automáticamente, contra un agregador público de datos de BYMA.
 *
 * ⚠️ El contrato de esta fuente no está documentado oficialmente y no se
 * pudo verificar en vivo desde el entorno donde se escribió este código
 * (la política de red del sandbox bloquea el host). `entrySchema` de abajo
 * es la mejor hipótesis sobre la forma de la respuesta. Si `getQuotes()`
 * empieza a devolver `quotes_available: false` en producción, es el primer
 * lugar para mirar: correr `curl https://data912.com/live/arg_cedears` y
 * ajustar `entrySchema` a los campos reales.
 */
const SOURCE_URL = 'https://data912.com/live/arg_cedears';
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

const entrySchema = z.object({
  symbol: z.string().min(1),
  // Precio de cierre/último. Se acepta null explícito de la fuente.
  c: z.number().nullable().optional(),
  pct_change: z.number().nullable().optional(),
});

function parseEntry(raw: unknown): Quote | null {
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ticker: parsed.data.symbol.toUpperCase(),
    price: parsed.data.c ?? null,
    change_pct: parsed.data.pct_change ?? null,
  };
}

/** Del JSON crudo de la fuente a un mapa ticker -> cotización, descartando lo que no matchea. */
export function parseQuotes(body: unknown): Map<string, Quote> {
  const quotes = new Map<string, Quote>();
  if (!Array.isArray(body)) return quotes;

  for (const raw of body) {
    const quote = parseEntry(raw);
    if (quote) quotes.set(quote.ticker, quote);
  }
  return quotes;
}

interface CacheEntry {
  fetchedAt: number;
  quotes: Map<string, Quote>;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<Map<string, Quote>> | null = null;

async function fetchQuotes(): Promise<Map<string, Quote>> {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`La fuente de cotizaciones respondió ${response.status}`);

  const body: unknown = await response.json();
  const quotes = parseQuotes(body);
  // Si la fuente respondió pero no se pudo interpretar ni una fila, algo
  // cambió de forma: se trata como falla para no cachear un mapa vacío que
  // taparía cotizaciones reales.
  if (Array.isArray(body) && body.length > 0 && quotes.size === 0) {
    throw new Error('La fuente de cotizaciones cambió de formato');
  }
  return quotes;
}

/**
 * Cotizaciones de CEDEARs, cacheadas unos minutos para no golpear la
 * fuente en cada request.
 *
 * Nunca tira: si la fuente externa falla, se sirve el cache anterior
 * aunque haya vencido, y si nunca hubo un fetch exitoso se devuelve un
 * mapa vacío. La sección Ahorros tiene que poder mostrar el costo cargado
 * a mano aunque la cotización no esté disponible.
 */
export async function getQuotes(): Promise<{ quotes: Map<string, Quote>; asOf: string | null }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { quotes: cache.quotes, asOf: new Date(cache.fetchedAt).toISOString() };
  }

  if (!inFlight) {
    inFlight = fetchQuotes().finally(() => {
      inFlight = null;
    });
  }

  try {
    const quotes = await inFlight;
    cache = { fetchedAt: now, quotes };
    return { quotes, asOf: new Date(now).toISOString() };
  } catch (err) {
    console.error('No se pudieron traer cotizaciones de CEDEARs:', err);
    if (cache) return { quotes: cache.quotes, asOf: new Date(cache.fetchedAt).toISOString() };
    return { quotes: new Map(), asOf: null };
  }
}

export function quoteFor(quotes: Map<string, Quote>, ticker: string): Quote | null {
  return quotes.get(ticker.toUpperCase()) ?? null;
}
