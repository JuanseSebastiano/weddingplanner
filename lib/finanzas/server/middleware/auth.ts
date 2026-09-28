import type { NextFunction, Request, Response } from '../http';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '../lib/supabase';
import { forbidden, unauthorized } from '../lib/errors';

export interface AuthContext {
  userId: string;
  email: string | null;
  coupleId: string;
  displayName: string;
}

/** Request con el contexto ya resuelto. Lo usan todos los handlers protegidos. */
export interface AuthedRequest extends Request {
  auth: AuthContext;
}

/**
 * Resuelve el usuario desde la sesión de Supabase (cookies de la app) y su
 * pareja en `couple_members`.
 *
 * El backend después consulta con service role (sin RLS), así que el
 * couple_id de acá es la frontera entre los datos de una pareja y los de
 * otra: toda query debe filtrar por él. RLS sigue activo como segunda línea.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw unauthorized('Sesión inválida o expirada');

    const { data: member, error: memberError } = await supabaseAdmin
      .from('couple_members')
      .select('user_id, couple_id, nombre')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) throw forbidden('Tu usuario todavía no pertenece a ninguna pareja.');

    (req as AuthedRequest).auth = {
      userId: member.user_id as string,
      email: data.user.email ?? null,
      coupleId: member.couple_id as string,
      displayName: (member.nombre as string) ?? '',
    };
    next();
  } catch (err) {
    next(err);
  }
}
