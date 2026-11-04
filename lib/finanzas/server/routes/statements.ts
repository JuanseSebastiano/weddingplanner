import { Router } from '../http';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler } from '../lib/errors';
import { personaDe, soloDe } from '../lib/persona';
import type { AuthedRequest } from '../middleware/auth';

export const statementsRouter = Router();

/**
 * Último resumen de cada tarjeta (de los últimos 60 días), con los totales
 * en pesos y en dólares sumados.
 */
statementsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const desde = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await soloDe(
      supabaseAdmin
        .from('fin_card_statements')
        .select('id, user_id, card, due_date, total_ars, total_usd, min_payment, received_at, owner:couple_members!fin_card_statements_user_id_fkey (display_name:nombre)')
        .eq('couple_id', req.auth.coupleId)
        .gte('received_at', desde)
        .order('received_at', { ascending: false }),
      personaDe(req),
    );
    if (error) throw error;

    const vistos = new Set<string>();
    const statements = (data ?? []).filter((s) => {
      const key = `${s.user_id}|${s.card}`;
      if (vistos.has(key)) return false;
      vistos.add(key);
      return true;
    });
    const suma = (campo: 'total_ars' | 'total_usd') =>
      Math.round(statements.reduce((acc, s) => acc + Number(s[campo] ?? 0), 0) * 100) / 100;

    res.json({ statements, total_ars: suma('total_ars'), total_usd: suma('total_usd') });
  }),
);
