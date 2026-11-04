import { parseAmount } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { collapseWhitespace, normalizeText } from './parsers/common';
import type { NormalizedEmail } from './parsers/types';

/**
 * Resúmenes de tarjeta ("Ya está listo el resumen de tu tarjeta"): se guardan
 * los totales en pesos y en dólares, el vencimiento y el pago mínimo. No son
 * compras, así que van antes de la cadena de parsers.
 */

export interface CardStatement {
  card: string;
  due_date: string | null;
  total_ars: number | null;
  total_usd: number | null;
  min_payment: number | null;
}

const MONTO = String.raw`(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)`;
const TOTAL_ARS = new RegExp(String.raw`(?:total|saldo|importe)[a-z\s]{0,30}?pesos\s*:?\s*(?:\$|ars)?\s*${MONTO}`);
const TOTAL_USD = new RegExp(String.raw`(?:total|saldo|importe)[a-z\s]{0,30}?dolares\s*:?\s*(?:u\$s|usd|us\$)?\s*${MONTO}`);
const SALDO_ARS = new RegExp(String.raw`saldo actual\s*:?\s*\$\s*${MONTO}`);
const SALDO_USD = new RegExp(String.raw`saldo actual[^u]{0,40}(?:u\$s|usd)\s*${MONTO}`);
const MINIMO = new RegExp(String.raw`pago minimo\s*:?\s*\$?\s*${MONTO}`);
const VENCIMIENTO = /vencimiento\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

const BANCOS: Array<[string, string]> = [
  ['galicia', 'Galicia'],
  ['santander', 'Santander'],
  ['bbva', 'BBVA'],
  ['macro', 'Macro'],
  ['icbc', 'ICBC'],
  ['hsbc', 'HSBC'],
  ['naranja', 'Naranja X'],
  ['brubank', 'Brubank'],
  ['bancociudad', 'Ciudad'],
  ['bna.com', 'Nación'],
];
const MARCAS: Array<[RegExp, string]> = [
  [/mastercard/, 'Mastercard'],
  [/\bvisa\b/, 'Visa'],
  [/american express|\bamex\b/, 'Amex'],
  [/\bcabal\b/, 'Cabal'],
];

function texto(email: NormalizedEmail): string {
  return normalizeText(collapseWhitespace(`${email.subject} ${email.body}`));
}

export function isCardStatement(email: NormalizedEmail): boolean {
  const t = texto(email);
  return /resumen/.test(t) && /tarjeta|mastercard|visa|amex/.test(t) && /pesos|dolares|saldo actual|pago minimo/.test(t);
}

function monto(re: RegExp, t: string): number | null {
  const m = re.exec(t);
  return m ? parseAmount(m[1]) : null;
}

export function parseCardStatement(email: NormalizedEmail): CardStatement | null {
  const t = texto(email);
  const total_ars = monto(TOTAL_ARS, t) ?? monto(SALDO_ARS, t);
  const total_usd = monto(TOTAL_USD, t) ?? monto(SALDO_USD, t);
  if (total_ars === null && total_usd === null) return null;

  const v = VENCIMIENTO.exec(t);
  const due_date = v
    ? `${v[3].length === 2 ? `20${v[3]}` : v[3]}-${v[2].padStart(2, '0')}-${v[1].padStart(2, '0')}`
    : null;
  const from = normalizeText(email.from);
  const banco = BANCOS.find(([dominio]) => from.includes(dominio))?.[1];
  const marca = MARCAS.find(([re]) => re.test(t))?.[1];

  return {
    card: [banco, marca].filter(Boolean).join(' ') || 'Tarjeta',
    due_date,
    total_ars,
    total_usd,
    min_payment: monto(MINIMO, t),
  };
}

interface Context {
  userId: string;
  coupleId: string;
}

type LogFn = (fields: {
  parser_id: string;
  parse_status: 'parsed' | 'failed';
  error_detail: string;
}) => Promise<string | null>;

/** Registra el mail y guarda los totales del resumen para el dueño del Gmail. */
export async function saveCardStatement(
  context: Context,
  email: NormalizedEmail,
  log: LogFn,
): Promise<'created' | 'duplicate' | 'failed'> {
  const statement = parseCardStatement(email);
  if (!statement) {
    await log({ parser_id: 'resumen', parse_status: 'failed', error_detail: 'Resumen de tarjeta sin totales reconocibles' });
    return 'failed';
  }

  const detalle = [
    statement.card,
    statement.total_ars !== null ? `$ ${statement.total_ars}` : null,
    statement.total_usd !== null ? `U$S ${statement.total_usd}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const logId = await log({ parser_id: 'resumen', parse_status: 'parsed', error_detail: detalle });
  if (!logId) return 'duplicate';

  const { error } = await supabaseAdmin.from('fin_card_statements').insert({
    couple_id: context.coupleId,
    user_id: context.userId,
    gmail_message_id: email.id,
    received_at: email.receivedAt?.toISOString() ?? null,
    ...statement,
  });
  if (error && error.code !== '23505') throw error;
  return 'created';
}
