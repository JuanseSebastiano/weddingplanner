import { Router } from '../http';
import { z } from 'zod';
import type { PendingExpense } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { personaDe, soloDe } from '../lib/persona';
import { assertBelongsToHousehold, EXPENSE_SELECT } from '../services/expenses';

/**
 * Vista de revisión: los gastos detectados desde mails entran como
 * `pending` y no suman en el dashboard hasta que el usuario los confirma.
 * Así un parseo errado nunca contamina los totales.
 */
const PENDING_SELECT = `
  ${EXPENSE_SELECT},
  ingestion:fin_email_ingestion_log!fin_expenses_email_ingestion_id_fkey (
    id, from_address, subject, received_at, raw_snippet, parser_id
  )
`;

const confirmSchema = z.object({
  amount: z.number().positive().optional(),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  merchant: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD')
    .optional(),
});

export const reviewRouter = Router();

/** Lista de pendientes de confirmación, del más nuevo al más viejo. */
reviewRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { data, error } = await soloDe(
      supabaseAdmin
        .from('fin_expenses')
        .select(PENDING_SELECT)
        .eq('couple_id', req.auth.coupleId)
        .eq('status', 'pending'),
      personaDe(req),
    ).order('created_at', { ascending: false });

    if (error) throw error;
    res.json((data ?? []) as unknown as PendingExpense[]);
  }),
);

async function loadPending(coupleId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from('fin_expenses')
    .select('id, user_id, status, email_ingestion_id')
    .eq('id', id)
    .eq('couple_id', coupleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw notFound('Gasto pendiente no encontrado');
  if (data.status !== 'pending') throw badRequest('Este gasto ya fue revisado');
  return data as { id: string; user_id: string; status: string; email_ingestion_id: string | null };
}

/** Confirma el gasto, con las correcciones que haya hecho el usuario. */
reviewRouter.post(
  '/:id/confirm',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.flatten());

    const id = req.params.id as string;
    const pending = await loadPending(req.auth.coupleId, id);
    // Los pendientes son de quien conectó su Gmail: solo él los revisa.
    if (pending.user_id !== req.auth.userId) {
      throw forbidden('Solo podés revisar los gastos detectados en tu propia casilla');
    }

    await assertBelongsToHousehold(req.auth.coupleId, {
      categoryId: parsed.data.category_id,
      accountId: parsed.data.account_id,
    });

    const patch: Record<string, unknown> = { ...parsed.data, status: 'confirmed' };
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

/**
 * Descarta un falso positivo. El gasto queda en estado `discarded` (no se
 * borra) y el log de ingesta lo registra, así el mismo mail no se
 * vuelve a proponer en la próxima sincronización.
 */
reviewRouter.post(
  '/:id/discard',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;
    const pending = await loadPending(req.auth.coupleId, id);
    if (pending.user_id !== req.auth.userId) {
      throw forbidden('Solo podés revisar los gastos detectados en tu propia casilla');
    }

    const { data, error } = await supabaseAdmin
      .from('fin_expenses')
      .update({ status: 'discarded' })
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .select(EXPENSE_SELECT)
      .single();

    if (error) throw error;

    if (pending.email_ingestion_id) {
      const { error: logError } = await supabaseAdmin
        .from('fin_email_ingestion_log')
        .update({ parse_status: 'ignored', error_detail: 'Descartado por el usuario en la revisión' })
        .eq('id', pending.email_ingestion_id);
      if (logError) throw logError;
    }

    res.json(data);
  }),
);
