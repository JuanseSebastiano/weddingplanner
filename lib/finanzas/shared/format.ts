/** Helpers de formato usados tanto por la UI como por los parsers de mails. */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency = 'ARS', locale = 'es-AR'): string {
  const key = `${locale}:${currency}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

/** "2026-07" -> "julio 2026" */
export function formatMonthLabel(month: string, locale = 'es-AR'): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, (m ?? 1) - 1, 1));
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-07-26" -> "26/07/2026" (sin corrimiento por zona horaria). */
export function formatDate(isoDate: string, locale = 'es-AR'): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(date);
}

/** Mes actual en formato YYYY-MM. */
export function currentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Primer y ultimo dia del mes YYYY-MM, como fechas ISO. */
export function monthBounds(month: string): { start: string; end: string } {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Desplaza un mes YYYY-MM en n meses (n puede ser negativo). */
export function addMonths(month: string, n: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + n, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Convierte un monto escrito en formato argentino a numero.
 * Acepta "$ 1.234,56", "1234.56", "ARS 1.234", "12,50".
 * Devuelve null si no hay un numero reconocible.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // Formato AR: el ultimo separador es la coma decimal.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Formato US, o AR con miles por coma.
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
