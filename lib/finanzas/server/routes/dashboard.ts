import { Router } from '../http';
import { z } from 'zod';
import { currentMonth } from '@nf/shared';
import { asyncHandler, badRequest } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { getAvailableSummary, getDashboardSummary } from '../services/dashboard';
import { getCommitmentsSummary } from '../services/commitments';

const querySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido, se espera YYYY-MM')
    .optional(),
});

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Parámetros inválidos', parsed.error.flatten());

    const summary = await getDashboardSummary(
      req.auth.coupleId,
      parsed.data.month ?? currentMonth(),
    );
    res.json(summary);
  }),
);

/** Disponible real: líquido menos deuda de tarjeta impaga, por moneda. */
dashboardRouter.get(
  '/available',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getAvailableSummary(req.auth.coupleId));
  }),
);

/** Compromisos futuros (boda, viaje, tarjetas), presupuesto del viaje y alerta. */
dashboardRouter.get(
  '/commitments',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getCommitmentsSummary(req.auth.coupleId));
  }),
);
