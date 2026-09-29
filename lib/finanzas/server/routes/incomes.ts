import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { assertIncomeRefs, getIncome, INCOME_SELECT, listIncomes } from '../services/incomes';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD');

const incomeInputSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a cero'),
  currency: z.enum(['ARS', 'USD']).optional(),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  payer: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  income_date: isoDate,
});

const filtersSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  user_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(200).optional(),
});

export const incomesRouter = Router();

incomesRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = filtersSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Filtros inválidos', parsed.error.flatten());

    const result = await listIncomes(req.auth.coupleId, parsed.data);
    res.json(result);
  }),
);

incomesRouter.get(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const income = await getIncome(req.auth.coupleId, req.params.id as string);
    if (!income) throw notFound('Ingreso no encontrado');
    res.json(income);
  }),
);

incomesRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = incomeInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos del ingreso inválidos', parsed.error.flatten());
    const input = parsed.data;
    const { coupleId, userId } = req.auth;

    await assertIncomeRefs(coupleId, {
      categoryId: input.category_id,
      accountId: input.account_id,
    });

    const { data, error } = await supabaseAdmin
      .from('fin_incomes')
      .insert({
        couple_id: coupleId,
        user_id: userId,
        account_id: input.account_id ?? null,
        category_id: input.category_id ?? null,
        amount: input.amount,
        currency: input.currency ?? 'ARS',
        payer: input.payer ?? null,
        description: input.description ?? null,
        income_date: input.income_date,
      })
      .select(INCOME_SELECT)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  }),
);

incomesRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = incomeInputSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos del ingreso inválidos', parsed.error.flatten());

    const id = req.params.id as string;
    const existing = await getIncome(req.auth.coupleId, id);
    if (!existing) throw notFound('Ingreso no encontrado');
    // Se ve todo lo del hogar, pero cada uno edita solo lo suyo.
    if (existing.user_id !== req.auth.userId) {
      throw forbidden('Solo podés editar tus propios ingresos');
    }

    await assertIncomeRefs(req.auth.coupleId, {
      categoryId: parsed.data.category_id,
      accountId: parsed.data.account_id,
    });

    const { data, error } = await supabaseAdmin
      .from('fin_incomes')
      .update(parsed.data)
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .select(INCOME_SELECT)
      .single();

    if (error) throw error;
    res.json(data);
  }),
);

incomesRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    const existing = await getIncome(req.auth.coupleId, id);
    if (!existing) throw notFound('Ingreso no encontrado');
    if (existing.user_id !== req.auth.userId) {
      throw forbidden('Solo podés borrar tus propios ingresos');
    }

    const { error } = await supabaseAdmin
      .from('fin_incomes')
      .delete()
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);
