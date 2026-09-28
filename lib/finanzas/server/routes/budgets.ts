import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { BUDGET_SELECT, getBudget, listBudgets } from '../services/budgets';

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
    if (!(await getBudget(req.auth.coupleId, id))) throw notFound('Tope no encontrado');

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
