import { Router } from '../http';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler, badRequest, unauthorized } from '../lib/errors';
import { findMatchingRule, loadRules } from '../services/rules-engine';
import { dayWindow, isSameCharge, matchAccount, parseShortcutPayload, todayAr } from '../services/shortcut';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const shortcutRouter = Router();

/**
 * Gasto desde la automatización de Wallet (Atajos de iOS). Sin sesión: lo
 * autentica `Authorization: Bearer <shortcut_token>` de la persona. Entra
 * confirmado; si el mail del banco ya lo había dejado pendiente, confirma
 * ese en vez de duplicarlo.
 */
shortcutRouter.post(
  '/gasto',
  asyncHandler(async (req, res) => {
    const token = (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!UUID.test(token)) throw unauthorized('Token del atajo inválido');

    const { data: member, error: memberError } = await supabaseAdmin
      .from('couple_members')
      .select('user_id, couple_id')
      .eq('shortcut_token', token)
      .not('user_id', 'is', null)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw unauthorized('Token del atajo inválido');

    const charge = parseShortcutPayload(req.body);
    if (!charge) throw badRequest('No se pudo leer el importe del pago');

    const date = todayAr();
    const { from, to } = dayWindow(date);

    const [pendingRes, accountsRes, rules] = await Promise.all([
      supabaseAdmin
        .from('fin_expenses')
        .select('id, amount, currency, expense_date')
        .eq('user_id', member.user_id)
        .eq('status', 'pending')
        .eq('source', 'email')
        .gte('expense_date', from)
        .lte('expense_date', to),
      supabaseAdmin
        .from('fin_accounts')
        .select('id, name, last4')
        .eq('owner_id', member.user_id)
        .eq('active', true),
      loadRules(member.couple_id),
    ]);
    if (pendingRes.error) throw pendingRes.error;
    if (accountsRes.error) throw accountsRes.error;

    const match = findMatchingRule(rules, { merchant: charge.merchant, description: charge.card });
    const accountId = match?.account_id ?? matchAccount(charge.card, accountsRes.data ?? []);

    const fromEmail = (pendingRes.data ?? []).find((e) =>
      isSameCharge({ ...charge, date }, { amount: e.amount, currency: e.currency, date: e.expense_date }),
    );

    const { error } = fromEmail
      ? await supabaseAdmin
          .from('fin_expenses')
          .update({ status: 'confirmed', merchant: charge.merchant ?? undefined })
          .eq('id', fromEmail.id)
      : await supabaseAdmin.from('fin_expenses').insert({
          couple_id: member.couple_id,
          user_id: member.user_id,
          account_id: accountId,
          category_id: match?.category_id ?? null,
          amount: charge.amount,
          currency: charge.currency,
          merchant: charge.merchant,
          description: charge.card ? `Apple Pay · ${charge.card}` : 'Apple Pay',
          expense_date: date,
          source: 'shortcut',
          status: 'confirmed',
          applied_rule_id: match?.rule.id ?? null,
        });
    if (error) throw error;

    res.status(201).json({ ok: true, amount: charge.amount, currency: charge.currency, merchant: charge.merchant });
  }),
);
