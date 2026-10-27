/**
 * Lógica pura del atajo de Apple Pay: lee lo que manda la automatización
 * de Wallet y decide cuenta y duplicados, sin base de datos.
 */
import { z } from 'zod';
import { formatCurrency, parseAmount } from '@nf/shared';
import { cleanMerchant, detectCurrency, normalizeText } from '../gmail/parsers/common';

const payloadSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  merchant: z.string().max(200).optional(),
  card: z.string().max(200).optional(),
});

export interface ShortcutCharge {
  amount: number;
  currency: 'ARS' | 'USD';
  merchant: string | null;
  card: string | null;
}

/** Wallet manda el importe como texto ("$1.234,56", "US$ 12.50"). */
export function parseShortcutPayload(body: unknown): ShortcutCharge | null {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return null;
  const raw = String(parsed.data.amount);
  const amount = typeof parsed.data.amount === 'number' ? parsed.data.amount : parseAmount(raw);
  if (amount === null || !(amount > 0)) return null;
  return {
    amount,
    currency: /US\$|U\$S|USD/i.test(raw) ? 'USD' : (detectCurrency(raw) as 'ARS' | 'USD'),
    merchant: cleanMerchant(parsed.data.merchant),
    card: parsed.data.card?.trim() || null,
  };
}

export interface AccountRef {
  id: string;
  name: string;
  last4: string | null;
}

/** Cuenta del gasto según el nombre de la tarjeta que informa Wallet. */
export function matchAccount(card: string | null, accounts: AccountRef[]): string | null {
  if (card) {
    const digits = /(\d{4})\D*$/.exec(card)?.[1];
    const byLast4 = digits ? accounts.find((a) => a.last4 === digits) : undefined;
    if (byLast4) return byLast4.id;
    const text = normalizeText(card);
    const byName = accounts.find((a) => text.includes(normalizeText(a.name)));
    if (byName) return byName.id;
  }
  return accounts.length === 1 ? accounts[0].id : null;
}

export interface ChargeRef {
  amount: number | string;
  currency: string;
  /** YYYY-MM-DD. */
  date: string;
}

/** Mismo consumo informado por dos vías: monto y moneda iguales, a ±1 día. */
export function isSameCharge(a: ChargeRef, b: ChargeRef): boolean {
  if (Number(a.amount) !== Number(b.amount) || a.currency !== b.currency) return false;
  const diff = Math.abs(Date.parse(a.date) - Date.parse(b.date));
  return diff <= 24 * 60 * 60 * 1000;
}

/** Fecha de hoy en Argentina, YYYY-MM-DD. */
export function todayAr(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** Día anterior y siguiente, para acotar la búsqueda de duplicados. */
export function dayWindow(date: string): { from: string; to: string } {
  const t = Date.parse(date);
  const day = 24 * 60 * 60 * 1000;
  return {
    from: new Date(t - day).toISOString().slice(0, 10),
    to: new Date(t + day).toISOString().slice(0, 10),
  };
}

/** Texto de la notificación del atajo: lo muestra tal cual "Mostrar notificación". */
export function mensajeAtajo(g: {
  amount: number;
  currency: string;
  merchant: string | null;
  rubro: string | null;
  cuenta: string | null;
  confirmado: boolean;
}): string {
  const monto = formatCurrency(g.amount, g.currency).replace(/,00$/, '');
  const titulo = `✅ ${monto}${g.merchant ? ` en ${g.merchant}` : ''}`;
  const detalle = [g.rubro, g.cuenta, g.confirmado ? 'ya había llegado el mail, quedó confirmado' : null]
    .filter(Boolean)
    .join(' · ');
  return detalle ? `${titulo}\n${detalle}` : titulo;
}
