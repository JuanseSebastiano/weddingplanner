import { Router } from '../http';
import { z } from 'zod';
import type { CategorizationRule } from '@nf/shared';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { assertBelongsToHousehold } from '../services/expenses';
import { applyRulesToUncategorized, findMatchingRule, loadRules } from '../services/rules-engine';

const ruleSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  priority: z.number().int().min(0).max(9999).optional(),
  match_field: z.enum(['merchant', 'sender', 'description']),
  match_type: z.enum(['contains', 'equals', 'regex']),
  pattern: z.string().trim().min(1, 'El patrón es obligatorio').max(300),
  category_id: z.string().uuid(),
  account_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

/** Una regex inválida se rechaza al crear la regla, no al ingerir mails. */
function assertValidPattern(matchType: string, pattern: string): void {
  if (matchType !== 'regex') return;
  try {
    new RegExp(pattern, 'i');
  } catch (err) {
    throw badRequest(`Expresión regular inválida: ${(err as Error).message}`);
  }
}

export const rulesRouter = Router();

rulesRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('fin_categorization_rules')
      .select('*')
      .eq('couple_id', req.auth.coupleId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data ?? []);
  }),
);

rulesRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Regla inválida', parsed.error.flatten());
    assertValidPattern(parsed.data.match_type, parsed.data.pattern);

    await assertBelongsToHousehold(req.auth.coupleId, {
      categoryId: parsed.data.category_id,
      accountId: parsed.data.account_id,
    });

    const { data, error } = await supabaseAdmin
      .from('fin_categorization_rules')
      .insert({
        couple_id: req.auth.coupleId,
        created_by: req.auth.userId,
        name: parsed.data.name,
        priority: parsed.data.priority ?? 100,
        match_field: parsed.data.match_field,
        match_type: parsed.data.match_type,
        pattern: parsed.data.pattern,
        category_id: parsed.data.category_id,
        account_id: parsed.data.account_id ?? null,
        active: parsed.data.active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  }),
);

rulesRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Regla inválida', parsed.error.flatten());
    if (parsed.data.pattern && parsed.data.match_type) {
      assertValidPattern(parsed.data.match_type, parsed.data.pattern);
    }

    await assertBelongsToHousehold(req.auth.coupleId, {
      categoryId: parsed.data.category_id,
      accountId: parsed.data.account_id,
    });

    const { data, error } = await supabaseAdmin
      .from('fin_categorization_rules')
      .update(parsed.data)
      .eq('id', req.params.id as string)
      .eq('couple_id', req.auth.coupleId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw notFound('Regla no encontrada');
    res.json(data);
  }),
);

rulesRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { error } = await supabaseAdmin
      .from('fin_categorization_rules')
      .delete()
      .eq('id', req.params.id as string)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);

/**
 * Prueba las reglas del hogar contra un comercio/descripción de ejemplo.
 * La UI lo usa para mostrar qué rubro asignaría antes de guardar.
 */
rulesRouter.post(
  '/test',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const schema = z.object({
      merchant: z.string().max(200).optional(),
      description: z.string().max(1000).optional(),
      sender: z.string().max(200).optional(),
      /** Regla candidata, todavía no guardada. */
      candidate: ruleSchema.optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.flatten());

    const subject = {
      merchant: parsed.data.merchant ?? null,
      description: parsed.data.description ?? null,
      sender: parsed.data.sender ?? null,
    };

    let rules = await loadRules(req.auth.coupleId);
    if (parsed.data.candidate) {
      assertValidPattern(parsed.data.candidate.match_type, parsed.data.candidate.pattern);
      const candidate = {
        ...parsed.data.candidate,
        id: 'candidate',
        couple_id: req.auth.coupleId,
        priority: parsed.data.candidate.priority ?? 0,
        account_id: parsed.data.candidate.account_id ?? null,
        active: true,
        created_by: req.auth.userId,
        created_at: new Date(0).toISOString(),
      } as CategorizationRule;
      rules = [candidate, ...rules];
    }

    const match = findMatchingRule(rules, subject);
    res.json({ matched: Boolean(match), rule: match?.rule ?? null, category_id: match?.category_id ?? null });
  }),
);

/**
 * Re-categoriza gastos existentes. Por defecto solo los que no tienen
 * rubro; con `dry_run` devuelve el impacto sin escribir.
 */
rulesRouter.post(
  '/apply',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const schema = z.object({
      dry_run: z.boolean().optional(),
      include_categorized: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.flatten());

    const result = await applyRulesToUncategorized(req.auth.coupleId, {
      dryRun: parsed.data.dry_run,
      includeCategorized: parsed.data.include_categorized,
    });

    res.json(result);
  }),
);
