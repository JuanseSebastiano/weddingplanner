import { Router } from '../http';
import { z } from 'zod';
import { currentMonth } from '@nf/shared';
import { asyncHandler, badRequest } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { personaDe } from '../lib/persona';
import { getCashflowSummary, listLedger } from '../services/cashflow';

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
