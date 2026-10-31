import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { currentMonth } from '@nf/shared';
import { assertWithinCap, BUDGET_SELECT, getBudget, getMonthlyPlan, listBudgets } from '../services/budgets';

const budgetInputSchema = z.object({
  category_id: z.string().uuid('Elegí un rubro'),
  amount: z.number().positive('El tope debe ser mayor a cero'),
});

/**
 * Confirma que el rubro exista, sea del hogar y sea de egreso.
 *
 * Lo último importa: un tope sobre un rubro de ingreso no significaría
 * nada, porque el gasto del mes de ese rubro siempre sería cero y el
 * presupuesto se vería eternamente al 0%.
 */
async function assertExpenseCategory(coupleId: string, categoryId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('fin_categories')
    .select('id, kind')
    .eq('id', categoryId)
    .eq('couple_id', coupleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw notFound('Rubro no encontrado');
  if (data.kind !== 'expense') {
    throw badRequest('Solo se le puede poner tope a un rubro de egreso');
  }
}

export const budgetsRouter = Router();

/** Presupuesto mensual del mes (por defecto el actual). */
budgetsRouter.get(
  '/plan',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const month = z.string().regex(/^\d{4}-\d{2}$/).optional().safeParse(req.query.month);
    if (!month.success) throw badRequest('Mes inválido');
    res.json(await getMonthlyPlan(req.auth.coupleId, month.data ?? currentMonth()));
  }),
);

/** Tope mensual total; null lo saca. */
budgetsRouter.patch(
  '/cap',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = z.object({ amount: z.number().positive().nullable() }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Tope inválido', parsed.error.flatten());
    if (parsed.data.amount !== null) await assertWithinCap(req.auth.coupleId, { cap: parsed.data.amount });

    const { error } = await supabaseAdmin
      .from('couples')
      .update({ fin_tope_mensual: parsed.data.amount })
      .eq('id', req.auth.coupleId);
    if (error) throw error;
    res.json(await getMonthlyPlan(req.auth.coupleId, currentMonth()));
  }),
);

/** Marca un rubro como variable (absorbe los excesos) o fijo. */
budgetsRouter.patch(
  '/variable/:categoryId',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = z.object({ variable: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Valor inválido');
    await assertExpenseCategory(req.auth.coupleId, req.params.categoryId as string);

    const { error } = await supabaseAdmin
      .from('fin_categories')
      .update({ variable: parsed.data.variable })
      .eq('id', req.params.categoryId as string)
      .eq('couple_id', req.auth.coupleId);
    if (error) throw error;
    res.json(await getMonthlyPlan(req.auth.coupleId, currentMonth()));
  }),
);

budgetsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await listBudgets(req.auth.coupleId));
  }),
);

budgetsRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = budgetInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Tope inválido', parsed.error.flatten());

    await assertExpenseCategory(req.auth.coupleId, parsed.data.category_id);
    await assertWithinCap(req.auth.coupleId, { categoryId: parsed.data.category_id, amount: parsed.data.amount });

    const { data, error } = await supabaseAdmin
      .from('fin_budgets')
      .insert({
        couple_id: req.auth.coupleId,
        category_id: parsed.data.category_id,
        amount: parsed.data.amount,
        created_by: req.auth.userId,
      })
      .select(BUDGET_SELECT)
      .single();

    if (error) {
      // Unique (couple_id, category_id): el rubro ya tiene tope.
      if (error.code === '23505') {
        throw conflict('Ese rubro ya tiene un tope. Editá el que está en vez de crear otro.');
      }
      throw error;
    }
    res.status(201).json(data);
  }),
);

budgetsRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    // El rubro no se puede cambiar: mover un tope de un rubro a otro es
    // borrarlo y crear otro, y así queda explícito en la pantalla.
    const parsed = budgetInputSchema.pick({ amount: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Tope inválido', parsed.error.flatten());

    const id = req.params.id as string;
    const budget = await getBudget(req.auth.coupleId, id);
    if (!budget) throw notFound('Tope no encontrado');
    await assertWithinCap(req.auth.coupleId, { categoryId: budget.category_id, amount: parsed.data.amount });

    const { data, error } = await supabaseAdmin
      .from('fin_budgets')
      .update({ amount: parsed.data.amount })
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .select(BUDGET_SELECT)
      .single();

    if (error) throw error;
    res.json(data);
  }),
);

budgetsRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    if (!(await getBudget(req.auth.coupleId, id))) throw notFound('Tope no encontrado');

    const { error } = await supabaseAdmin
      .from('fin_budgets')
      .delete()
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);
