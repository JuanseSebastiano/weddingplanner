import type { Commitment, PresupuestoSummary } from '@nf/shared';
import { CERO, calcularItem, sumar, type Item, type Pago } from '@/lib/plata';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Presupuesto de la boda y del viaje con sus pagos programados. Los datos
 * quedan en su módulo: la boda se calcula igual que en /boda/presupuesto y
 * el viaje sale de la vista trip_budget (cuotas incluidas).
 */
export async function getPresupuestoSummary(coupleId: string): Promise<PresupuestoSummary> {
  const [itemsRes, pagosRes, weddingRes, viajeRes, compromisosRes] = await Promise.all([
    supabaseAdmin.from('wedding_budget_items').select('*').eq('couple_id', coupleId),
    supabaseAdmin.from('wedding_payments').select('*').eq('couple_id', coupleId),
    supabaseAdmin.from('wedding_info').select('cotizacion_referencia').eq('couple_id', coupleId).maybeSingle(),
    supabaseAdmin.from('trip_budget').select('currency, total, paid, pending').eq('couple_id', coupleId),
    supabaseAdmin
      .from('fin_commitments')
      .select('source, ref_id, due_date, amount, currency, fx_rate, label, href')
      .eq('couple_id', coupleId)
      .in('source', ['boda', 'viaje'])
      .order('due_date', { ascending: true, nullsFirst: false }),
  ]);
  for (const res of [itemsRes, pagosRes, weddingRes, viajeRes, compromisosRes]) {
    if (res.error) throw res.error;
  }

  const cotizacion = Number(weddingRes.data?.cotizacion_referencia ?? 0);
  const items = (itemsRes.data ?? []) as Item[];
  const pagos = ((pagosRes.data ?? []) as Pago[]).map((p) => ({
    ...p,
    monto: Number(p.monto),
    cotizacion_usd: p.cotizacion_usd === null ? null : Number(p.cotizacion_usd),
  }));

  let boda: PresupuestoSummary['boda'] = null;
  if (items.length > 0 && cotizacion > 0) {
    const calculados = items.map((item) =>
      calcularItem(
        {
          ...item,
          monto_estimado: Number(item.monto_estimado),
          monto_real: item.monto_real === null ? null : Number(item.monto_real),
        },
        pagos,
        cotizacion,
      ),
    );
    boda = {
      previsto: calculados.reduce((acc, c) => sumar(acc, c.previsto), CERO),
      pagado: calculados.reduce((acc, c) => sumar(acc, c.pagado), CERO),
      pendiente: calculados.reduce((acc, c) => sumar(acc, c.pendiente), CERO),
      cotizacion,
    };
  }

  return {
    boda,
    viaje: (viajeRes.data ?? []).map((row) => ({
      currency: row.currency,
      total: Number(row.total),
      paid: Number(row.paid),
      pending: Number(row.pending),
    })),
    pagos: (compromisosRes.data ?? []).map(
      (row): Commitment => ({
        source: row.source,
        ref_id: row.ref_id,
        due_date: row.due_date,
        amount: Number(row.amount),
        currency: row.currency,
        fx_rate: row.fx_rate === null ? null : Number(row.fx_rate),
        label: row.label,
        href: row.href,
      }),
    ),
  };
}
