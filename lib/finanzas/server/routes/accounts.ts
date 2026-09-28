import { Router } from '../http';
import { z } from 'zod';
import { ACCOUNT_TYPES } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';

const accountSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  type: z.enum(ACCOUNT_TYPES as [string, ...string[]]).optional(),
  bank_name: z.string().trim().max(80).nullable().optional(),
  last4: z
    .string()
    .regex(/^\d{4}$/, 'Se esperan los últimos 4 dígitos')
    .nullable()
    .optional(),
  active: z.boolean().optional(),
  balance: z.number().nullable().optional(),
  balance_currency: z.enum(['ARS', 'USD']).optional(),
  closing_day: z.number().int().min(1).max(31).nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
});

/** Registra cuándo se actualizó el saldo, para mostrar su antigüedad. */
function withBalanceStamp<T extends { balance?: number | null }>(input: T) {
  return input.balance === undefined ? input : { ...input, balance_updated_at: new Date().toISOString() };
}

export const accountsRouter = Router();

accountsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('fin_accounts')
      .select('*')
      .eq('couple_id', req.auth.coupleId)
      .order('name');

    if (error) throw error;
    res.json(data ?? []);
  }),
);

accountsRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Cuenta inválida', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('fin_accounts')
      .insert({
        couple_id: req.auth.coupleId,
        owner_id: req.auth.userId,
        name: parsed.data.name,
        type: parsed.data.type ?? 'credit_card',
        bank_name: parsed.data.bank_name ?? null,
        last4: parsed.data.last4 ?? null,
        ...withBalanceStamp({
          balance: parsed.data.balance,
          balance_currency: parsed.data.balance_currency ?? 'ARS',
        }),
        closing_day: parsed.data.closing_day ?? null,
        due_day: parsed.data.due_day ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  }),
);

accountsRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = accountSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Cuenta inválida', parsed.error.flatten());

    const id = req.params.id as string;
    const { data: existing, error: findError } = await supabaseAdmin
      .from('fin_accounts')
      .select('id, owner_id')
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) throw notFound('Cuenta no encontrada');
    if (existing.owner_id !== req.auth.userId) throw forbidden('Solo podés editar tus propias cuentas');

    const { data, error } = await supabaseAdmin
      .from('fin_accounts')
      .update(withBalanceStamp(parsed.data))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  }),
);

accountsRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    const { data: existing, error: findError } = await supabaseAdmin
      .from('fin_accounts')
      .select('id, owner_id')
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) throw notFound('Cuenta no encontrada');
    if (existing.owner_id !== req.auth.userId) throw forbidden('Solo podés borrar tus propias cuentas');

    const { error } = await supabaseAdmin.from('fin_accounts').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  }),
);
