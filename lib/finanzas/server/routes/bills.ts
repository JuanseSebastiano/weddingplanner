import { Router } from '../http';
import { z } from 'zod';
import { currentMonth, type BillOfMonth } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { personaDe, soloDe } from '../lib/persona';
import { dueDate } from '../services/bills-math';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Mes inválido, se espera YYYY-MM');

const billSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  user_id: z.string().uuid(),
  amount: z.number().positive().nullable().optional(),
  currency: z.enum(['ARS', 'USD']).optional(),
  due_day: z.number().int().min(1).max(31),
});

const BILL_SELECT = 'id, user_id, name, amount, currency, due_day, owner:couple_members!fin_bills_user_id_fkey (nombre)';

export const billsRouter = Router();

/** Pagos fijos del mes con su vencimiento y si ya se pagaron. */
billsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = monthSchema.optional().safeParse(req.query.month);
    if (!parsed.success) throw badRequest('Mes inválido', parsed.error.flatten());
    const month = parsed.data ?? currentMonth();

    const [billsRes, paidRes] = await Promise.all([
      soloDe(supabaseAdmin.from('fin_bills').select(BILL_SELECT).eq('couple_id', req.auth.coupleId), personaDe(req)),
      supabaseAdmin.from('fin_bill_payments').select('bill_id').eq('couple_id', req.auth.coupleId).eq('month', month),
    ]);
    if (billsRes.error) throw billsRes.error;
    if (paidRes.error) throw paidRes.error;

    const paid = new Set((paidRes.data ?? []).map((row) => row.bill_id));
    const rows = (billsRes.data ?? []) as unknown as Array<
      Omit<BillOfMonth, 'owner' | 'due_date' | 'paid'> & { owner: { nombre: string } | null }
    >;
    const bills: BillOfMonth[] = rows
      .map((row) => ({
        ...row,
        amount: row.amount === null ? null : Number(row.amount),
        owner: row.owner?.nombre ?? '',
        due_date: dueDate(month, row.due_day),
        paid: paid.has(row.id),
      }))
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name));
    res.json(bills);
  }),
);

billsRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = billSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Pago inválido', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('fin_bills')
      .insert({ ...parsed.data, couple_id: req.auth.coupleId })
      .select('id')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);

billsRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = billSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Pago inválido', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('fin_bills')
      .update(parsed.data)
      .eq('id', req.params.id as string)
      .eq('couple_id', req.auth.coupleId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound('Pago no encontrado');
    res.json(data);
  }),
);

billsRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { error } = await supabaseAdmin
      .from('fin_bills')
      .delete()
      .eq('id', req.params.id as string)
      .eq('couple_id', req.auth.coupleId);
    if (error) throw error;
    res.status(204).end();
  }),
);

/** Marca o desmarca el pago de un mes: `{ month, paid }`. */
billsRouter.post(
  '/:id/paid',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = z.object({ month: monthSchema, paid: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.flatten());
    const id = req.params.id as string;

    const { data: bill, error: billError } = await supabaseAdmin
      .from('fin_bills')
      .select('id')
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .maybeSingle();
    if (billError) throw billError;
    if (!bill) throw notFound('Pago no encontrado');

    const { error } = parsed.data.paid
      ? await supabaseAdmin
          .from('fin_bill_payments')
          .upsert({ bill_id: id, couple_id: req.auth.coupleId, month: parsed.data.month })
      : await supabaseAdmin.from('fin_bill_payments').delete().eq('bill_id', id).eq('month', parsed.data.month);
    if (error) throw error;
    res.status(204).end();
  }),
);
