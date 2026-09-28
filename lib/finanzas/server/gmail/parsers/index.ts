import { parseAmount } from '@nf/shared';
import {
  cleanMerchant,
  detectCurrency,
  extractField,
  findDate,
  findLast4,
  genericParse,
  MERCHANT_PATTERNS,
  normalizeText,
  senderMatches,
} from './common';
import type { EmailParser, NormalizedEmail, ParsedNotification } from './types';

export type { EmailParser, NormalizedEmail, ParsedNotification } from './types';

/**
 * Un parser por emisor. Se evalúan en orden: el primero cuyo `matches`
 * devuelva true es el que parsea. `genericParser` cierra la lista como
 * red de contención.
 *
 * Para sumar un banco nuevo: agregá un objeto acá y un caso en
 * test/parsers.test.ts con un mail real (anonimizado).
 */

/** Visa / Santander: "Consumo en COMERCIO por $ 12.345,67". */
const santanderParser: EmailParser = {
  id: 'santander',
  label: 'Santander',
  matches: (email) => senderMatches(email, ['santander.com.ar', 'santanderrio', 'santander.com']),
  parse: (email) =>
    genericParse(email, [
      /(?:consumo|compra|pago)\s+en\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60}?)\s+por\s+\$/i,
      ...MERCHANT_PATTERNS,
    ]),
};

/** Galicia: "Realizaste una compra por $X en COMERCIO". */
const galiciaParser: EmailParser = {
  id: 'galicia',
  label: 'Banco Galicia',
  matches: (email) => senderMatches(email, ['bancogalicia.com.ar', 'galicia.ar', 'galicia.com.ar']),
  parse: (email) =>
    genericParse(email, [
      /por\s+\$\s*[\d.,]+\s+en\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60}?)(?:\s+el\s|[.,]|$)/i,
      ...MERCHANT_PATTERNS,
    ]),
};

/** BBVA: "Compra con tarjeta ... Comercio: NOMBRE". */
const bbvaParser: EmailParser = {
  id: 'bbva',
  label: 'BBVA',
  matches: (email) => senderMatches(email, ['bbva.com', 'bbva.com.ar', 'frances.com.ar']),
  parse: (email) => genericParse(email, MERCHANT_PATTERNS),
};

/**
 * Mercado Pago: los avisos traen el comercio en el asunto
 * ("Pagaste $1.500 en Farmacity") o en el cuerpo.
 */
const mercadoPagoParser: EmailParser = {
  id: 'mercadopago',
  label: 'Mercado Pago',
  matches: (email) => senderMatches(email, ['mercadopago.com', 'mercadolibre.com']),
  parse: (email): ParsedNotification | null =>
    genericParse(email, [
      /(?:pagaste|pago de|compraste)[^$]*\$\s*[\d.,]+\s+(?:a|en)\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60}?)(?:\s+con\s|\s+el\s|[.,]|$)/i,
      /(?:a|en)\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60}?)\s+por\s+\$/i,
      ...MERCHANT_PATTERNS,
    ]),
};

/** Naranja X. */
const naranjaParser: EmailParser = {
  id: 'naranja',
  label: 'Naranja X',
  matches: (email) => senderMatches(email, ['naranja.com', 'naranjax.com']),
  parse: (email) => genericParse(email, MERCHANT_PATTERNS),
};

/**
 * Alertas directas de Visa (no de un banco puntual): "Su tarjeta Visa
 * terminada en 1234 se usó...", con los datos en líneas "Campo: valor"
 * separadas en vez de una oración armada. El extractor genérico busca el
 * monto pegado al símbolo de moneda ("$ 1.234,56"), y acá "Moneda: ARS" y
 * "Monto: 6490.00" van en líneas distintas — necesita su propio lector.
 */
const visaDirectParser: EmailParser = {
  id: 'visa',
  label: 'Visa (alerta directa)',
  matches: (email) => senderMatches(email, ['visa.com']),
  parse: (email): ParsedNotification | null => {
    const text = email.body || email.subject;
    const rawAmount = extractField(text, 'Monto');
    const amount = rawAmount ? parseAmount(rawAmount) : null;
    if (amount === null || amount <= 0) return null;

    const currencyField = extractField(text, 'Moneda');
    const cardField = extractField(text, 'Tarjeta');

    return {
      amount,
      currency: currencyField ? currencyField.toUpperCase() : detectCurrency(text),
      merchant: cleanMerchant(extractField(text, 'Comercio')),
      date:
        findDate(text, (email.receivedAt ?? new Date()).getFullYear()) ??
        (email.receivedAt ? email.receivedAt.toISOString().slice(0, 10) : null),
      last4: cardField && /^\d{4}$/.test(cardField) ? cardField : findLast4(text),
    };
  },
};

/**
 * Red de contención: cualquier mail que hable de un consumo y traiga un
 * monto. Deliberadamente conservador — si no reconoce monto, no propone
 * nada, y el gasto igual queda pendiente de confirmación.
 */
const genericParser: EmailParser = {
  id: 'generic',
  label: 'Genérico',
  matches: (email) => {
    const text = normalizeText(`${email.subject} ${email.snippet}`);
    return /(consumo|compra|pago|debito|extraccion|transferencia)/.test(text);
  },
  parse: (email) => genericParse(email, MERCHANT_PATTERNS),
};

export const PARSERS: EmailParser[] = [
  santanderParser,
  galiciaParser,
  bbvaParser,
  mercadoPagoParser,
  naranjaParser,
  visaDirectParser,
  genericParser,
];

export interface ParseResult {
  parser: EmailParser;
  parsed: ParsedNotification | null;
}

/** Corre la cadena de parsers. Devuelve null si ninguno aplica al mail. */
export function parseEmail(email: NormalizedEmail): ParseResult | null {
  for (const parser of PARSERS) {
    if (!parser.matches(email)) continue;
    return { parser, parsed: parser.parse(email) };
  }
  return null;
}
