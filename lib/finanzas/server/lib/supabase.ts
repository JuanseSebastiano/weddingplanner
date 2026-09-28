import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let client: SupabaseClient | null = null;

/**
 * Cliente con service role: ignora RLS. Todas las consultas del backend
 * pasan por acá, así que cada query DEBE filtrar por couple_id o
 * user_id explícitamente (ver requireAuth en middleware/auth.ts).
 *
 * Se crea al primer uso (no al importar) para que el build no necesite la
 * service role key.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    client ??= createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return Reflect.get(client, prop, client);
  },
});
