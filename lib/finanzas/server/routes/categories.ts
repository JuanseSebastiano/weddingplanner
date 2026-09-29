import { Router } from '../http';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser hexadecimal, ej. #2563eb')
    .optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  kind: z.enum(['expense', 'income']).optional(),
});

const listQuerySchema = z.object({
  kind: z.enum(['expense', 'income']).optional(),
});

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Filtros inválidos', parsed.error.flatten());

    // Sin `kind` devuelve los dos tipos: el frontend cachea un solo
    // catálogo y filtra en memoria según la pantalla.
    let query = supabaseAdmin
      .from('fin_categories')
      .select('*')
      .eq('couple_id', req.auth.coupleId);

    if (parsed.data.kind) query = query.eq('kind', parsed.data.kind);

    const { data, error } = await query.order('kind').order('name');

    if (error) throw error;
    res.json(data ?? []);
  }),
);

categoriesRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Rubro inválido', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('fin_categories')
      .insert({
        couple_id: req.auth.coupleId,
        name: parsed.data.name,
        color: parsed.data.color ?? '#64748b',
        icon: parsed.data.icon ?? null,
        kind: parsed.data.kind ?? 'expense',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw conflict('Ya existe un rubro con ese nombre');
      throw error;
    }
    res.status(201).json(data);
  }),
);

categoriesRouter.patch(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const parsed = categorySchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Rubro inválido', parsed.error.flatten());

    // El tipo es inmutable: pasar un rubro de egreso a ingreso dejaría a
    // todos los gastos ya imputados apuntando a un rubro del otro lado.
    const { kind: _kind, ...patch } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from('fin_categories')
      .update(patch)
      .eq('id', req.params.id as string)
      .eq('couple_id', req.auth.coupleId)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') throw conflict('Ya existe un rubro con ese nombre');
      throw error;
    }
    if (!data) throw notFound('Rubro no encontrado');
    res.json(data);
  }),
);

categoriesRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const id = req.params.id as string;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('fin_categories')
      .select('id, is_default')
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) throw notFound('Rubro no encontrado');
    if (existing.is_default) throw badRequest('Los rubros por defecto no se pueden borrar');

    // Los gastos quedan sin rubro (FK on delete set null), no se pierden.
    const { error } = await supabaseAdmin
      .from('fin_categories')
      .delete()
      .eq('id', id)
      .eq('couple_id', req.auth.coupleId);

    if (error) throw error;
    res.status(204).end();
  }),
);
