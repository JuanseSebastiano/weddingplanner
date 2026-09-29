import { Router } from '../http';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler } from '../lib/errors';
import type { AuthedRequest } from '../middleware/auth';
import { isGmailConfigured } from '../config';

export const meRouter = Router();

/**
 * Contexto de arranque del frontend: quién soy, con quién comparto el
 * hogar y si mi casilla de Gmail está conectada.
 */
meRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const [householdRes, membersRes, gmailRes] = await Promise.all([
      supabaseAdmin.from('couples').select('id, name:nombre').eq('id', req.auth.coupleId).maybeSingle(),
      supabaseAdmin
        .from('couple_members')
        .select('id:user_id, display_name:nombre')
        .eq('couple_id', req.auth.coupleId)
        .not('user_id', 'is', null)
        .order('nombre'),
      supabaseAdmin
        .from('fin_gmail_credentials')
        .select('gmail_address, last_synced_at')
        .eq('user_id', req.auth.userId)
        .maybeSingle(),
    ]);

    for (const result of [householdRes, membersRes, gmailRes]) {
      if (result.error) throw result.error;
    }

    res.json({
      user: {
        id: req.auth.userId,
        email: req.auth.email,
        display_name: req.auth.displayName,
      },
      household: householdRes.data,
      members: membersRes.data ?? [],
      gmail: {
        available: isGmailConfigured(),
        connected: Boolean(gmailRes.data),
        address: gmailRes.data?.gmail_address ?? null,
        last_synced_at: gmailRes.data?.last_synced_at ?? null,
      },
    });
  }),
);
