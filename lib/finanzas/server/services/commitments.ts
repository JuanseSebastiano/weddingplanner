import type { CommitmentsSummary, Commitment } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Compromisos futuros (vista fin_commitments: boda, viaje y tarjetas),
 * presupuesto del viaje y alerta de cobertura del próximo pago de la boda.
 *
 * Para comparar monedas todo se lleva a pesos: con la cotización del
 * propio pago si la tiene, o con la de referencia de la boda.
 */
export async function getCommitmentsSummary(coupleId: string): Promise<CommitmentsSummary> {
  const [commitmentsRes, availableRes, budgetRes, weddingRes] = await Promise.all([
    supabaseAdmin
      .from('fin_commitments')
      .select('source, ref_id, due_date, amount, currency, fx_rate, label, href')
      .eq('couple_id', coupleId)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabaseAdmin.from('fin_available_now').select('currency, available').eq('couple_id', coupleId),
    supabaseAdmin.from('trip_budget').select('currency, total, paid, pending').eq('couple_id', coupleId),
    supabaseAdmin.from('wedding_info').select('cotizacion_referencia').eq('couple_id', coupleId).maybeSingle(),
  ]);
  for (const res of [commitmentsRes, availableRes, budgetRes, weddingRes]) {
    if (res.error) throw res.error;
  }

  const referenceRate = Number(weddingRes.data?.cotizacion_referencia ?? 0) || null;
  const toArs = (amount: number, currency: string, fx: number | null) =>
    currency === 'ARS' ? amount : amount * (fx ?? referenceRate ?? 0);

  const commitments: Commitment[] = (commitmentsRes.data ?? []).map((row) => ({
    source: row.source,
    ref_id: row.ref_id,
    due_date: row.due_date,
    amount: Number(row.amount),
    currency: row.currency,
    fx_rate: row.fx_rate === null ? null : Number(row.fx_rate),
    label: row.label,
    href: row.href,
  }));

  const availableArs = (availableRes.data ?? []).reduce(
    (acc, row) => acc + toArs(Number(row.available), row.currency, null),
    0,
  );

  // Próximo pago pendiente de la boda (incluye los vencidos sin pagar).
  const nextWedding = commitments.find((c) => c.source === 'boda' && c.due_date);
  let alert: CommitmentsSummary['alert'] = null;
  if (nextWedding && referenceRate) {
    // Lo de tarjetas ya está descontado del disponible real; se restan los
    // otros compromisos que vencen antes que este pago.
    const before = commitments.filter(
      (c) => c !== nextWedding && c.source !== 'tarjeta' && c.due_date && c.due_date <= nextWedding.due_date!,
    );
    const projected = availableArs - before.reduce((acc, c) => acc + toArs(c.amount, c.currency, c.fx_rate), 0);
    const needed = toArs(nextWedding.amount, nextWedding.currency, nextWedding.fx_rate);
    if (projected < needed) {
      alert = { commitment: nextWedding, projected_ars: Math.round(projected), needed_ars: Math.round(needed) };
    }
  }

  return {
    commitments,
    available_ars: Math.round(availableArs),
    reference_rate: referenceRate,
    trip_budget: (budgetRes.data ?? []).map((row) => ({
      currency: row.currency,
      total: Number(row.total),
      paid: Number(row.paid),
      pending: Number(row.pending),
    })),
    alert,
  };
}
