import { Router } from '../http';
import { z } from 'zod';
import { formatCurrency } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { personaDe } from '../lib/persona';
import { HOLDING_SELECT } from '../services/holdings';
import { getCash, getMovement, listMovements, SAVINGS_SELECT } from '../services/savings';
import { investmentAmount, mergePosition, type Position } from '../services/savings-math';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD');

const movementSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a cero'),
  moved_at: isoDate,
  account_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

const investSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'El ticker es obligatorio')
    .max(10, 'Los tickers de BYMA no superan los 10 caracteres')
    .transform((value) => value.toUpperCase()),
  quantity: z.number().positive('La cantidad debe ser mayor a cero'),
  price: z.number().positive('El precio debe ser mayor a cero'),
  moved_at: isoDate,
  broker: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const savingsRouter = Router();

savingsRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const userId = personaDe(req);
    const [movements, cash] = await Promise.all([
      listMovements(req.auth.coupleId, userId),
      getCash(req.auth.coupleId, undefined, userId),
    ]);
    res.json({ movements, cash });
  }),
);

/** Apartar plata: la "transferencia" que se carga desde el form de gastos. */
savingsRouter.post(
  '/deposits',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Movimiento inválido', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('fin_savings_movements')
      .insert({
        couple_id: req.auth.coupleId,
        user_id: req.auth.userId,
        kind: 'deposit',
        amount: parsed.data.amount,
        moved_at: parsed.data.moved_at,
        account_id: parsed.data.account_id ?? null,
        description: parsed.data.description ?? null,
      })
      .select(SAVINGS_SELECT)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  }),
);

/** Sacar plata de la caja de vuelta a la cuenta. */
savingsRouter.post(
  '/withdrawals',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Movimiento inválido', parsed.error.flatten());

    const cash = await getCash(req.auth.coupleId);
    if (parsed.data.amount > cash.available) {
      throw badRequest(
        `No hay tanto efectivo sin invertir: quedan ${formatCurrency(cash.available)}.`,
      );
    }

    const { data, error } = await supabaseAdmin
      .from('fin_savings_movements')
      .insert({
        couple_id: req.auth.coupleId,
        user_id: req.auth.userId,
        kind: 'withdrawal',
        amount: parsed.data.amount,
        moved_at: parsed.data.moved_at,
        account_id: parsed.data.account_id ?? null,
        description: parsed.data.description ?? null,
      })
      .select(SAVINGS_SELECT)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  }),
);

/**
 * Convertir efectivo de la caja en una tenencia.
 *
 * Son dos escrituras que idealmente irían en una transacción, y supabase-js
 * no las ofrece desde el cliente. Se hace primero la tenencia y después el
 * movimiento, y si el movimiento falla se revierte la tenencia al estado
 * anterior. El orden importa: al revés, una falla dejaría la plata
 * descontada de la caja sin tenencia que la respalde, que es el peor de los
 * dos estados intermedios — plata que desaparece.
 */
savingsRouter.post(
  '/investments',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = investSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Inversión inválida', parsed.error.flatten());

    const { ticker, quantity, price, moved_at, broker, notes } = parsed.data;
    const amount = investmentAmount(quantity, price);

    const cash = await getCash(req.auth.coupleId);
    if (amount > cash.available) {
      throw badRequest(
        `La compra sale ${formatCurrency(amount)} y en la caja quedan ${formatCurrency(cash.available)}. ` +
          'Apartá más plata desde un gasto con destino Ahorros, o comprá menos cantidad.',
      );
    }

    // La posición es por persona (unique user_id + ticker), así que se busca
    // la propia: si la otra persona ya tiene ese CEDEAR, son dos filas.
    const { data: existing, error: findError } = await supabaseAdmin
      .from('fin_holdings')
      .select('id, quantity, avg_cost')
      .eq('couple_id', req.auth.coupleId)
      .eq('user_id', req.auth.userId)
      .eq('ticker', ticker)
      .maybeSingle();

    if (findError) throw findError;

    const previous: Position | null = existing
      ? { quantity: Number(existing.quantity), avg_cost: Number(existing.avg_cost) }
      : null;
    const merged = mergePosition(previous, quantity, price);

    let holdingId: string;
    if (existing) {
      const { error } = await supabaseAdmin
        .from('fin_holdings')
        .update({ quantity: merged.quantity, avg_cost: merged.avg_cost })
        .eq('id', existing.id);
      if (error) throw error;
      holdingId = existing.id as string;
    } else {
      const { data, error } = await supabaseAdmin
        .from('fin_holdings')
        .insert({
          couple_id: req.auth.coupleId,
          user_id: req.auth.userId,
          ticker,
          quantity: merged.quantity,
          avg_cost: merged.avg_cost,
          broker: broker ?? 'Balanz',
          notes: notes ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      holdingId = data.id as string;
    }

    const { error: movementError } = await supabaseAdmin.from('fin_savings_movements').insert({
      couple_id: req.auth.coupleId,
      user_id: req.auth.userId,
      kind: 'investment',
      amount,
      moved_at,
      holding_id: holdingId,
      description: notes ?? null,
    });

    if (movementError) {
      // Compensación: dejar la tenencia como estaba antes de este pedido.
      if (previous) {
        await supabaseAdmin
          .from('fin_holdings')
          .update({ quantity: previous.quantity, avg_cost: previous.avg_cost })
          .eq('id', holdingId);
      } else {
        await supabaseAdmin.from('fin_holdings').delete().eq('id', holdingId);
      }
      throw movementError;
    }

    const { data: holding, error: reloadError } = await supabaseAdmin
      .from('fin_holdings')
      .select(HOLDING_SELECT)
      .eq('id', holdingId)
      .single();

    if (reloadError) throw reloadError;
    res.status(201).json({ holding, invested: amount });
  }),
);

savingsRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    const existing = await getMovement(req.auth.coupleId, id);
    if (!existing) throw notFound('Movimiento no encontrado');
    if (existing.user_id !== req.auth.userId) {
      throw forbidden('Solo podés borrar tus propios movimientos');
    }
    if (existing.kind === 'investment') {
      throw badRequest(
        'Una inversión no se borra desde acá: borrá la tenencia y los pesos vuelven al efectivo sin invertir.',
      );
    }

    // Borrar un depósito no puede dejar la caja en rojo: si esa plata ya se
    // invirtió o se retiró, primero hay que deshacer eso.
    if (existing.kind === 'deposit') {
      const cash = await getCash(req.auth.coupleId);
      if (Number(existing.amount) > cash.available) {
        throw badRequest(
          'Ese ingreso a ahorros ya está invertido o retirado. Deshacé esa operación antes de borrarlo.',
        );
      }
    }

    const { error } = await supabaseAdmin
      .from('fin_savings_movements')
      .delete()
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);
