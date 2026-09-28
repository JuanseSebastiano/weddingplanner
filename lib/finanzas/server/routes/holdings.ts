import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { getHolding, HOLDING_SELECT, listHoldings } from '../services/holdings';

const holdingInputSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'El ticker es obligatorio')
    .max(10, 'Los tickers de BYMA no superan los 10 caracteres')
    .transform((value) => value.toUpperCase()),
  quantity: z.number().positive('La cantidad debe ser mayor a cero'),
  avg_cost: z.number().positive('El costo promedio debe ser mayor a cero'),
  broker: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const holdingsRouter = Router();

holdingsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await listHoldings(req.auth.coupleId));
  }),
);

holdingsRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = holdingInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Tenencia inválida', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('fin_holdings')
      .insert({
        couple_id: req.auth.coupleId,
        user_id: req.auth.userId,
        ticker: parsed.data.ticker,
        quantity: parsed.data.quantity,
        avg_cost: parsed.data.avg_cost,
        broker: parsed.data.broker ?? 'Balanz',
        notes: parsed.data.notes ?? null,
      })
      .select(HOLDING_SELECT)
      .single();

    if (error) {
      // Unique (user_id, ticker): ya existe la posición, se edita en vez de duplicar.
      if (error.code === '23505') {
        throw conflict(`Ya tenés una posición en ${parsed.data.ticker}. Editala en vez de crear otra.`);
      }
      throw error;
    }
    res.status(201).json(data);
  }),
);

holdingsRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = holdingInputSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Tenencia inválida', parsed.error.flatten());

    const id = req.params.id as string;
    const existing = await getHolding(req.auth.coupleId, id);
    if (!existing) throw notFound('Tenencia no encontrada');
    if (existing.user_id !== req.auth.userId) {
      throw forbidden('Solo podés editar tus propias tenencias');
    }

    const { data, error } = await supabaseAdmin
      .from('fin_holdings')
      .update(parsed.data)
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .select(HOLDING_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw conflict(`Ya tenés una posición en ${parsed.data.ticker}. Editala en vez de duplicarla.`);
      }
      throw error;
    }
    res.json(data);
  }),
);

holdingsRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    const existing = await getHolding(req.auth.coupleId, id);
    if (!existing) throw notFound('Tenencia no encontrada');
    if (existing.user_id !== req.auth.userId) {
      throw forbidden('Solo podés borrar tus propias tenencias');
    }

    const { error } = await supabaseAdmin
      .from('fin_holdings')
      .delete()
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);
