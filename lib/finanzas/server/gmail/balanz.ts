import { parseAmount } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { getUsdRate } from '../services/fx-rate';
import { collapseWhitespace, normalizeText, senderMatches } from './parsers/common';
import type { NormalizedEmail } from './parsers/types';

/**
 * Boletos de Balanz ("Operaciones concertadas el DD/MM/AAAA"): cada fila es
 * una compra o venta de un CEDEAR. Se aplican directo sobre fin_holdings,
 * sin pasar por revisión.
 */

export interface BalanzOperation {
  boleto: string;
  tipo: 'COMPRA' | 'VENTA';
  ticker: string;
  cantidad: number;
  /** Columna Neto: bruto + arancel. */
  neto: number;
  moneda: 'USD' | 'ARS';
}

export function isBalanzBoletos(email: NormalizedEmail): boolean {
  if (!senderMatches(email, ['balanz.com'])) return false;
  const text = normalizeText(`${email.subject} ${email.body}`);
  return text.includes('boleto') || text.includes('operaciones concertadas');
}

const MONTO = String.raw`(usd|u\$s|\$)\s*([\d.,]+)`;
/** #Boleto, Tipo, Ticker, Descripción, Cant., Precio, Bruto, Arancel, IVA, Der. Mercado, Neto. */
const FILA = new RegExp(
  String.raw`(\d{1,3}(?:\.\d{3})+)\s+(COMPRA|VENTA)\s+([A-Z0-9.]{1,10})\s+.+?\s+(\d[\d.]*(?:,\d+)?)\s+` +
    Array.from({ length: 6 }, () => MONTO).join(String.raw`\s+`),
  'gi',
);

export function parseBalanzBoletos(email: NormalizedEmail): BalanzOperation[] {
  const text = collapseWhitespace(email.body);
  const ops: BalanzOperation[] = [];
  for (const m of text.matchAll(FILA)) {
    const cantidad = Number(m[4].replace(/\./g, '').replace(',', '.'));
    // Neto: el último par símbolo/monto de la fila.
    const neto = parseAmount(m[16]);
    if (!cantidad || !neto) continue;
    ops.push({
      boleto: m[1],
      tipo: m[2].toUpperCase() as BalanzOperation['tipo'],
      ticker: m[3].toUpperCase(),
      cantidad,
      neto,
      moneda: m[15] === '$' ? 'ARS' : 'USD',
    });
  }
  return ops;
}

export interface HoldingState {
  quantity: number;
  avg_cost: number;
}

export type HoldingChange =
  | { action: 'insert' | 'update'; quantity: number; avg_cost: number }
  | { action: 'delete' | 'skip' };

/** Cómo queda la tenencia después de una operación. `rate` = pesos por dólar. */
export function applyOperation(existing: HoldingState | null, op: BalanzOperation, rate: number): HoldingChange {
  const netoArs = op.moneda === 'USD' ? op.neto * rate : op.neto;
  if (op.tipo === 'COMPRA') {
    if (!existing) {
      return { action: 'insert', quantity: op.cantidad, avg_cost: Math.round((netoArs / op.cantidad) * 100) / 100 };
    }
    const quantity = existing.quantity + op.cantidad;
    const avg = (existing.quantity * existing.avg_cost + netoArs) / quantity;
    return { action: 'update', quantity, avg_cost: Math.round(avg * 100) / 100 };
  }
  if (!existing) return { action: 'skip' };
  const quantity = existing.quantity - op.cantidad;
  if (quantity <= 0) return { action: 'delete' };
  return { action: 'update', quantity, avg_cost: existing.avg_cost };
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

/** Registra el mail y aplica sus operaciones sobre las tenencias del dueño del Gmail. */
export async function applyBalanzEmail(
  context: Context,
  email: NormalizedEmail,
  log: LogFn,
): Promise<'created' | 'duplicate' | 'failed'> {
  const ops = parseBalanzBoletos(email);
  if (ops.length === 0) {
    await log({ parser_id: 'balanz', parse_status: 'failed', error_detail: 'No se encontraron operaciones en el boleto' });
    return 'failed';
  }

  let rate = 0;
  if (ops.some((op) => op.moneda === 'USD')) {
    const fx = await getUsdRate();
    // Sin registrar: el próximo sync lo vuelve a intentar.
    if (!fx) throw new Error('Sin cotización MEP para convertir el boleto de Balanz');
    rate = fx.rate;
  }

  const resumen = ops.map((op) => `${op.tipo} ${op.ticker} ${op.cantidad}`).join(' · ');
  const logId = await log({ parser_id: 'balanz', parse_status: 'parsed', error_detail: resumen.slice(0, 500) });
  if (!logId) return 'duplicate';

  const salteadas: string[] = [];
  for (const op of ops) {
    const { data: existing, error } = await supabaseAdmin
      .from('fin_holdings')
      .select('id, quantity, avg_cost')
      .eq('user_id', context.userId)
      .eq('ticker', op.ticker)
      .maybeSingle();
    if (error) throw error;

    const state = existing ? { quantity: Number(existing.quantity), avg_cost: Number(existing.avg_cost) } : null;
    const change = applyOperation(state, op, rate);

    let res;
    if (change.action === 'insert') {
      res = await supabaseAdmin.from('fin_holdings').insert({
        couple_id: context.coupleId,
        user_id: context.userId,
        ticker: op.ticker,
        quantity: change.quantity,
        avg_cost: change.avg_cost,
        broker: 'Balanz',
      });
    } else if (change.action === 'update') {
      res = await supabaseAdmin
        .from('fin_holdings')
        .update({ quantity: change.quantity, avg_cost: change.avg_cost })
        .eq('id', existing!.id);
    } else if (change.action === 'delete') {
      res = await supabaseAdmin.from('fin_holdings').delete().eq('id', existing!.id);
    } else {
      salteadas.push(op.ticker);
      continue;
    }
    if (res.error) throw res.error;
  }

  if (salteadas.length > 0) {
    await supabaseAdmin
      .from('fin_email_ingestion_log')
      .update({ error_detail: `${resumen} · Venta sin tenencia: ${salteadas.join(', ')}`.slice(0, 500) })
      .eq('id', logId);
  }
  return 'created';
}
