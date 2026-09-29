import { z } from 'zod';
import type { Request } from '../http';
import { badRequest } from './errors';

/**
 * Persona elegida en el selector de Finanzas (`?user_id=`). Sin parámetro
 * se ve la pareja. Las consultas siguen filtradas por couple_id, así que un
 * id ajeno a la pareja solo devuelve vacío.
 */
export function personaDe(req: Request): string | undefined {
  const parsed = z.string().uuid().optional().safeParse(req.query.user_id);
  if (!parsed.success) throw badRequest('Persona inválida', parsed.error.flatten());
  return parsed.data;
}

/** Agrega `.eq(columna, userId)` solo si hay persona elegida. */
export function soloDe<T>(query: T, userId: string | undefined, column = 'user_id'): T {
  if (!userId) return query;
  return (query as unknown as { eq(column: string, value: string): T }).eq(column, userId);
}
