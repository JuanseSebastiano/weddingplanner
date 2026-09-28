import { parseAmount } from '@nf/shared';
import type { NormalizedEmail, ParsedNotification } from './types';

/** Meses en español, para las fechas escritas con nombre ("12 de julio de 2026"). */
const MONTHS: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value: string): string {
  return stripAccents(value).toLowerCase();
}

/** Colapsa espacios y saltos de línea; los mails HTML dejan mucho ruido. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function senderMatches(email: NormalizedEmail, domains: string[]): boolean {
  const from = normalizeText(email.from);
  return domains.some((domain) => from.includes(domain.toLowerCase()));
}

const CURRENCY_PATTERNS: Array<[RegExp, string]> = [
  [/\bUSD\b|\bU\$S|\bdolares?\b|\bd[oó]lares?\b/i, 'USD'],
  [/\bARS\b|\$/, 'ARS'],
];

export function detectCurrency(text: string): string {
  for (const [pattern, currency] of CURRENCY_PATTERNS) {
    if (pattern.test(text)) return currency;
  }
  return 'ARS';
}

/**
 * Busca el primer monto del texto. Acepta "$ 12.345,67", "ARS 1234.56",
 * "USD 40,00". Devuelve null si no encuentra nada plausible.
 */
export function findAmount(text: string): { amount: number; currency: string } | null {
  const pattern = /(?:\$|ARS|USD|U\$S)\s*([\d][\d.,\s]*\d|\d)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const raw = (match[1] ?? '').replace(/\s/g, '');
    const amount = parseAmount(raw);
    if (amount !== null && amount > 0) {
      return { amount, currency: detectCurrency(match[0]) };
    }
  }
  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Busca una fecha en el texto. Soporta dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd y
 * "12 de julio de 2026". Ante formatos ambiguos asume día/mes (formato AR).
 */
export function findDate(text: string, fallbackYear = new Date().getFullYear()): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const parsed = toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (parsed) return parsed;
  }

  const numeric = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const rawYear = numeric[3];
    let year = rawYear ? Number(rawYear) : fallbackYear;
    if (year < 100) year += 2000;
    const parsed = toIsoDate(year, month, day);
    if (parsed) return parsed;
  }

  const written = /\b(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)(?:\s+de\s+(\d{4}))?/.exec(text);
  if (written) {
    const day = Number(written[1]);
    const month = MONTHS[normalizeText(written[2] ?? '')];
    const year = written[3] ? Number(written[3]) : fallbackYear;
    if (month) {
      const parsed = toIsoDate(year, month, day);
      if (parsed) return parsed;
    }
  }

  return null;
}

/** Últimos 4 dígitos de la tarjeta: "terminada en 1234", "****1234". */
export function findLast4(text: string): string | null {
  const patterns = [
    /(?:terminad[ao]s?\s+en|final(?:izada)?\s+en|termina\s+en)\s*[:\-]?\s*(\d{4})\b/i,
    /(?:\*{2,}|x{2,}|X{2,}|·{2,})\s*(\d{4})\b/,
    /\bN[°º]?\s*\*{2,}\s*(\d{4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Limpia el nombre del comercio que viene del mail (mayúsculas, códigos, relleno). */
export function cleanMerchant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = collapseWhitespace(raw)
    .replace(/[.,;:]+$/, '')
    .replace(/\s+(?:S\.?A\.?|S\.?R\.?L\.?)$/i, '')
    // Códigos de terminal que agregan algunos adquirentes: "COTO 0341*ABC".
    .replace(/\s+\d{3,}\*?\w*$/, '')
    .trim();

  if (!value || value.length < 2) return null;
  if (value.length > 80) value = value.slice(0, 80).trim();

  // Los mails suelen mandar el comercio en mayúsculas: se pasa a Capitalizado.
  if (value === value.toUpperCase()) {
    value = value
      .toLowerCase()
      .split(' ')
      .map((word) => (word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  return value;
}

/**
 * Cuerpo y asunto por separado, en ese orden. Concatenarlos haría que un
 * patrón de comercio se coma el arranque del cuerpo ("...en YPF Hola,").
 */
export function textCandidates(email: NormalizedEmail): string[] {
  return [collapseWhitespace(email.body), collapseWhitespace(email.subject)].filter(Boolean);
}

/** Primer comercio que encuentre alguno de los patrones, mirando cuerpo y luego asunto. */
export function findMerchant(email: NormalizedEmail, patterns: RegExp[]): string | null {
  for (const text of textCandidates(email)) {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      const merchant = cleanMerchant(match?.[1]);
      if (merchant) return merchant;
    }
  }
  return null;
}

/**
 * Extrae el valor de un campo "Etiqueta: valor" que ocupa su propia línea,
 * como usan las alertas estructuradas (ej. los avisos directos de Visa, a
 * diferencia de los mails de bancos que arman una oración).
 *
 * Opera sobre texto con saltos de línea reales: `collapseWhitespace` los
 * borra y el campo dejaría de tener límite de dónde termina el valor.
 */
export function extractField(text: string, label: string): string | null {
  const pattern = new RegExp(`^[ \\t]*${label}[ \\t]*:[ \\t]*(.+)$`, 'im');
  return pattern.exec(text)?.[1]?.trim() || null;
}

/** Fecha del consumo; si el mail no la trae, la de recepción del mail. */
export function findEmailDate(email: NormalizedEmail): string | null {
  const year = (email.receivedAt ?? new Date()).getFullYear();
  for (const text of textCandidates(email)) {
    const date = findDate(text, year);
    if (date) return date;
  }
  return email.receivedAt ? email.receivedAt.toISOString().slice(0, 10) : null;
}

/**
 * Estrategia genérica: sirve como red de contención cuando el emisor no
 * tiene un parser propio pero el mail claramente informa un consumo.
 */
export function genericParse(email: NormalizedEmail, merchantPatterns: RegExp[]): ParsedNotification | null {
  const candidates = textCandidates(email);

  let found: { amount: number; currency: string } | null = null;
  for (const text of candidates) {
    found = findAmount(text);
    if (found) break;
  }
  if (!found) return null;

  let last4: string | null = null;
  for (const text of candidates) {
    last4 = findLast4(text);
    if (last4) break;
  }

  return {
    amount: found.amount,
    currency: found.currency,
    merchant: findMerchant(email, merchantPatterns),
    date: findEmailDate(email),
    last4,
  };
}

/** Patrones de comercio compartidos por casi todos los emisores. */
export const MERCHANT_PATTERNS: RegExp[] = [
  /(?:en el comercio|en comercio|comercio)\s*[:\-]?\s*"?([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60}?)"?(?:\s+por|\s+el d[ií]a|\s+por un|[.,]|$)/i,
  /(?:compra|consumo|pago)\s+en\s+"?([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60}?)"?(?:\s+por|\s+el d[ií]a|[.,]|$)/i,
  /(?:establecimiento|negocio)\s*[:\-]\s*([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.'\- ]{2,60})/i,
];
