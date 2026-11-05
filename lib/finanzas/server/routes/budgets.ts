import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { currentMonth } from '@nf/shared';
import { assertWithinCap, BUDGET_SELECT, getBudget, getMonthlyPlan, listBudgets } from '../services/budgets';

const budgetInputSchema = z.object({
  category_id: z.string().uuid('Elegí un rubro'),
  amount: z.number().positive('El tope debe ser mayor a cero'),
  user_id: z.string().uuid().optional(),
});

/** El presupuesto de un integrante de la pareja: cada uno arma el suyo y el otro lo puede ver o editar. */
async function assertMember(coupleId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('couple_members')
    .select('user_id')
    .eq('couple_id', coupleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Integrante no encontrado');
}

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

/** Presupuesto mensual del mes (por defecto el actual), de una persona o, sin user_id, de los dos. */
budgetsRouter.get(
  '/plan',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const month = z.string().regex(/^\d{4}-\d{2}$/).optional().safeParse(req.query.month);
    const userId = z.string().uuid().optional().safeParse(req.query.user_id);
    if (!month.success || !userId.success) throw badRequest('Filtros inválidos');
    if (userId.data) await assertMember(req.auth.coupleId, userId.data);
    res.json(await getMonthlyPlan(req.auth.coupleId, month.data ?? currentMonth(), userId.data ?? null));
  }),
);

/** Tope mensual de una persona (por defecto quien pide); null lo saca. */
budgetsRouter.patch(
  '/cap',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = z
      .object({ amount: z.number().positive().nullable(), user_id: z.string().uuid().optional() })
      .safeParse(req.body);
    if (!parsed.success) throw badRequest('Tope inválido', parsed.error.flatten());
    const userId = parsed.data.user_id ?? req.auth.userId;
    await assertMember(req.auth.coupleId, userId);
    if (parsed.data.amount !== null) await assertWithinCap(req.auth.coupleId, userId, { cap: parsed.data.amount });

    const { error } = await supabaseAdmin
      .from('couple_members')
      .update({ fin_tope_mensual: parsed.data.amount })
      .eq('couple_id', req.auth.coupleId)
      .eq('user_id', userId);
    if (error) throw error;
    res.json(await getMonthlyPlan(req.auth.coupleId, currentMonth(), userId));
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
    res.status(204).end();
  }),
);

budgetsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await listBudgets(req.auth.coupleId, req.auth.userId));
  }),
);

budgetsRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = budgetInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Tope inválido', parsed.error.flatten());

    await assertExpenseCategory(req.auth.coupleId, parsed.data.category_id);
    const userId = parsed.data.user_id ?? req.auth.userId;
    await assertMember(req.auth.coupleId, userId);
    await assertWithinCap(req.auth.coupleId, userId, { categoryId: parsed.data.category_id, amount: parsed.data.amount });

    // Si el rubro ya tenía tope (p. ej. dos guardados seguidos), se actualiza.
    const { data, error } = await supabaseAdmin
      .from('fin_budgets')
      .upsert(
        {
          couple_id: req.auth.coupleId,
          category_id: parsed.data.category_id,
          amount: parsed.data.amount,
          user_id: userId,
          created_by: req.auth.userId,
        },
        { onConflict: 'couple_id,category_id,user_id' },
      )
      .select(BUDGET_SELECT)
      .single();

    if (error) throw error;
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
    await assertWithinCap(req.auth.coupleId, budget.user_id, { categoryId: budget.category_id, amount: parsed.data.amount });

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
