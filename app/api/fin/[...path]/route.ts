import { dispatch } from "@/lib/finanzas/server/http";
import { requireAuth } from "@/lib/finanzas/server/middleware/auth";
import { meRouter } from "@/lib/finanzas/server/routes/me";
import { expensesRouter } from "@/lib/finanzas/server/routes/expenses";
import { incomesRouter } from "@/lib/finanzas/server/routes/incomes";
import { cashflowRouter } from "@/lib/finanzas/server/routes/cashflow";
import { holdingsRouter } from "@/lib/finanzas/server/routes/holdings";
import { portfolioRouter } from "@/lib/finanzas/server/routes/portfolio";
import { savingsRouter } from "@/lib/finanzas/server/routes/savings";
import { budgetsRouter } from "@/lib/finanzas/server/routes/budgets";
import { categoriesRouter } from "@/lib/finanzas/server/routes/categories";
import { accountsRouter } from "@/lib/finanzas/server/routes/accounts";
import { dashboardRouter } from "@/lib/finanzas/server/routes/dashboard";
import { reviewRouter } from "@/lib/finanzas/server/routes/review";
import { rulesRouter } from "@/lib/finanzas/server/routes/rules";
import { gmailRouter } from "@/lib/finanzas/server/routes/gmail";

// La sincronización de Gmail (manual o por cron) puede tardar.
export const maxDuration = 60;

const auth = [requireAuth];

// Mismo montaje que tenía la app de Express. Gmail no lleva auth a nivel
// router: el callback de OAuth, el cron y el webhook se autentican solos.
const MOUNTS = [
  { prefix: "/gmail", router: gmailRouter },
  { prefix: "/me", router: meRouter, before: auth },
  { prefix: "/expenses", router: expensesRouter, before: auth },
  { prefix: "/incomes", router: incomesRouter, before: auth },
  { prefix: "/cashflow", router: cashflowRouter, before: auth },
  { prefix: "/holdings", router: holdingsRouter, before: auth },
  { prefix: "/portfolio", router: portfolioRouter, before: auth },
  { prefix: "/savings", router: savingsRouter, before: auth },
  { prefix: "/budgets", router: budgetsRouter, before: auth },
  { prefix: "/categories", router: categoriesRouter, before: auth },
  { prefix: "/accounts", router: accountsRouter, before: auth },
  { prefix: "/dashboard", router: dashboardRouter, before: auth },
  { prefix: "/review", router: reviewRouter, before: auth },
  { prefix: "/rules", router: rulesRouter, before: auth },
];

function handler(request: Request) {
  return dispatch(request, "/api/fin", MOUNTS);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
