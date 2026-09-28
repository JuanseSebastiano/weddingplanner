import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { assertBelongsToHousehold, EXPENSE_SELECT, getExpense, listExpenses } from '../services/expenses';
import { categorize } from '../services/rules-engine';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD');

const expenseInputSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a cero'),
  currency: z.enum(['ARS', 'USD']).optional(),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  merchant: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  expense_date: isoDate,
});

const filtersSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  user_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  source: z.enum(['manual', 'email']).optional(),
  status: z.enum(['pending', 'confirmed', 'discarded']).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(200).optional(),
});

export const expensesRouter = Router();

expensesRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = filtersSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Filtros inválidos', parsed.error.flatten());

    const result = await listExpenses(req.auth.coupleId, parsed.data);
    res.json(result);
  }),
);

expensesRouter.get(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const expense = await getExpense(req.auth.coupleId, req.params.id as string);
    if (!expense) throw notFound('Gasto no encontrado');
    res.json(expense);
  }),
);

expensesRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = expenseInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos del gasto inválidos', parsed.error.flatten());
    const input = parsed.data;
    const { coupleId, userId } = req.auth;

    await assertBelongsToHousehold(coupleId, {
      categoryId: input.category_id,
      accountId: input.account_id,
    });

    // Sin rubro explícito, las reglas de categorización intentan asignarlo.
    let categoryId = input.category_id ?? null;
    let appliedRuleId: string | null = null;
    if (!categoryId) {
      const match = await categorize(coupleId, {
        merchant: input.merchant ?? null,
        description: input.description ?? null,
      });
      if (match) {
        categoryId = match.category_id;
        appliedRuleId = match.rule.id;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('fin_expenses')
      .insert({
        couple_id: coupleId,
        user_id: userId,
        account_id: input.account_id ?? null,
        category_id: categoryId,
        amount: input.amount,
        currency: input.currency ?? 'ARS',
        merchant: input.merchant ?? null,
        description: input.description ?? null,
        expense_date: input.expense_date,
        source: 'manual',
        status: 'confirmed',
        applied_rule_id: appliedRuleId,
      })
      .select(EXPENSE_SELECT)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  }),
);

expensesRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = expenseInputSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos del gasto inválidos', parsed.error.flatten());

    const id = req.params.id as string;
    const existing = await getExpense(req.auth.coupleId, id);
    if (!existing) throw notFound('Gasto no encontrado');
    // Se ve todo lo del hogar, pero cada uno edita solo lo suyo.
    if (existing.user_id !== req.auth.userId) throw forbidden('Solo podés editar tus propios gastos');

    await assertBelongsToHousehold(req.auth.coupleId, {
      categoryId: parsed.data.category_id,
      accountId: parsed.data.account_id,
    });

    const patch: Record<string, unknown> = { ...parsed.data };
    // Si el usuario elige el rubro a mano, deja de estar atado a una regla.
    if ('category_id' in parsed.data) patch.applied_rule_id = null;

    const { data, error } = await supabaseAdmin
      .from('fin_expenses')
      .update(patch)
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .select(EXPENSE_SELECT)
      .single();

    if (error) throw error;
    res.json(data);
  }),
);

expensesRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    const existing = await getExpense(req.auth.coupleId, id);
    if (!existing) throw notFound('Gasto no encontrado');
    if (existing.user_id !== req.auth.userId) throw forbidden('Solo podés borrar tus propios gastos');

    const { error } = await supabaseAdmin
      .from('fin_expenses')
      .delete()
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);
