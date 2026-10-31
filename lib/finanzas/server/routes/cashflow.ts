import { Router } from '../http';
import { z } from 'zod';
import { currentMonth } from '@nf/shared';
import { asyncHandler, badRequest } from '../lib/errors';
import { supabaseAdmin } from '../lib/supabase';
import type { AuthedRequest } from '../middleware/auth';
import { personaDe } from '../lib/persona';
import { getCashflowSummary, listLedger } from '../services/cashflow';
import { getCashflowProjection } from '../services/projection';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD');
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Mes inválido, se espera YYYY-MM');

const ledgerFiltersSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  kind: z.enum(['income', 'expense']).optional(),
  user_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(200).optional(),
});

export const cashflowRouter = Router();

cashflowRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = monthSchema.optional().safeParse(req.query.month);
    if (!parsed.success) throw badRequest('Mes inválido', parsed.error.flatten());

    const summary = await getCashflowSummary(req.auth.coupleId, parsed.data ?? currentMonth(), personaDe(req));
    res.json(summary);
  }),
);

cashflowRouter.get(
  '/ledger',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = ledgerFiltersSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Filtros inválidos', parsed.error.flatten());

    const result = await listLedger(req.auth.coupleId, parsed.data);
    res.json(result);
  }),
);

/** Cash flow proyectado de la pareja hasta el último pago de boda o viaje. */
cashflowRouter.get(
  '/projection',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getCashflowProjection(req.auth.coupleId));
  }),
);

/** Gasto del mes cargado a mano para un mes proyectado; null vuelve al promedio. */
cashflowRouter.patch(
  '/projection/:month',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const month = monthSchema.safeParse(req.params.month);
    const body = z.object({ living: z.number().min(0).nullable() }).safeParse(req.body);
    if (!month.success || !body.success) throw badRequest('Gasto inválido');

    const { error } =
      body.data.living === null
        ? await supabaseAdmin
            .from('fin_projection_living')
            .delete()
            .eq('couple_id', req.auth.coupleId)
            .eq('month', month.data)
        : await supabaseAdmin.from('fin_projection_living').upsert({
            couple_id: req.auth.coupleId,
            month: month.data,
            living: body.data.living,
            updated_at: new Date().toISOString(),
          });
    if (error) throw error;
    res.json(await getCashflowProjection(req.auth.coupleId));
  }),
);
