import { Router } from '../http';
import { asyncHandler } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { getPortfolioSummary } from '../services/portfolio';

export const portfolioRouter = Router();

portfolioRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getPortfolioSummary(req.auth.coupleId));
  }),
);
