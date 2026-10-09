import { z } from 'zod';
import type { FxRate } from '@nf/shared';

/**
 * Cotización del dólar MEP (bolsa) — la referencia
 * habitual en Argentina para valuar en dólares algo que se compra y se
 * vende en pesos, que es exactamente el caso de un CEDEAR.
 *
 * ⚠️ Igual que con market-data.ts, el contrato de esta fuente
 * (dolarapi.com) no se pudo verificar en vivo desde el entorno donde se
 * escribió este código: la política de red del sandbox bloquea el host.
 * `rawSchema` es la mejor hipótesis sobre la forma de la respuesta. Si
 * `getUsdRate()` empieza a devolver null en producción, correr
 * `curl https://dolarapi.com/v1/dolares/bolsa` y ajustar el
 * schema a los campos reales es el primer paso (documentado en el README).
 */
const SOURCE_URL = 'https://dolarapi.com/v1/dolares/bolsa';
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

const rawSchema = z.object({
  // Lado venta: lo que costaría hoy comprar esos dólares. Es el número
  // relevante para valuar una tenencia, no el de compra.
  venta: z.number(),
  fechaActualizacion: z.string().optional(),
});

export function parseFxRate(body: unknown): FxRate | null {
  const parsed = rawSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    rate: parsed.data.venta,
    source: 'MEP',
    updated_at: parsed.data.fechaActualizacion ?? new Date().toISOString(),
  };
}

interface CacheEntry {
  fetchedAt: number;
  rate: FxRate;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<FxRate> | null = null;

async function fetchRate(): Promise<FxRate> {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`La fuente de cotización del dólar respondió ${response.status}`);

  const body: unknown = await response.json();
  const rate = parseFxRate(body);
  if (!rate) throw new Error('La fuente de cotización del dólar cambió de formato');
  return rate;
}

/**
 * Cotización del dólar MEP, cacheada unos minutos.
 *
 * Nunca tira: ante una falla sirve el cache anterior aunque haya vencido,
 * y si nunca hubo un fetch exitoso devuelve null. La cartera tiene que
 * poder verse en pesos aunque esto no responda — el toggle a USD
 * simplemente queda deshabilitado.
 */
export async function getUsdRate(): Promise<FxRate | null> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.rate;

  if (!inFlight) {
    inFlight = fetchRate().finally(() => {
      inFlight = null;
    });
  }

  try {
    const rate = await inFlight;
    cache = { fetchedAt: now, rate };
    return rate;
  } catch (err) {
    console.error('No se pudo traer la cotización del dólar:', err);
    return cache?.rate ?? null;
  }
}
