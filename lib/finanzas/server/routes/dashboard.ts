import { Router } from '../http';
import { z } from 'zod';
import { currentMonth } from '@nf/shared';
import { asyncHandler, badRequest } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { personaDe } from '../lib/persona';
import { getAvailableSummary, getDashboardSummary } from '../services/dashboard';
import { getCommitmentsSummary } from '../services/commitments';
import { getPresupuestoSummary } from '../services/presupuesto';

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
      personaDe(req),
    );
    res.json(summary);
  }),
);

/** Disponible real: líquido menos deuda de tarjeta impaga, por moneda. */
dashboardRouter.get(
  '/available',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getAvailableSummary(req.auth.coupleId, personaDe(req)));
  }),
);

/** Compromisos futuros (boda, viaje, tarjetas), presupuesto del viaje y alerta. */
dashboardRouter.get(
  '/commitments',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getCommitmentsSummary(req.auth.coupleId, personaDe(req)));
  }),
);

/** Presupuesto de la boda y del viaje con sus pagos programados (de la pareja). */
dashboardRouter.get(
  '/presupuesto',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getPresupuestoSummary(req.auth.coupleId));
  }),
);
