import { Router } from '../http';
import { supabaseAdmin } from '../lib/supabase';
import { HttpError, badRequest, unauthorized } from '../lib/errors';
import { findMatchingRule, loadRules } from '../services/rules-engine';
import { dayWindow, isSameCharge, matchAccount, mensajeAtajo, parseShortcutPayload, todayAr } from '../services/shortcut';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const shortcutRouter = Router();

/**
 * Gasto desde la automatización de Wallet (Atajos de iOS). Sin sesión: lo
 * autentica `Authorization: Bearer <shortcut_token>` de la persona. Entra
 * confirmado; si el mail del banco ya lo había dejado pendiente, confirma
 * ese en vez de duplicarlo.
 *
 * Responde texto plano, aun en error: el atajo lo muestra tal cual en la
 * notificación.
 */
shortcutRouter.post('/gasto', async (req, res) => {
  try {
    res.status(201).text(await cargarGasto(req.header('authorization'), req.body));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const motivo = err instanceof HttpError ? err.message : 'error del servidor, probá de nuevo';
    if (!(err instanceof HttpError)) console.error('[atajo]', err);
    res.status(status).text(`⚠️ No se cargó el gasto: ${motivo}`);
  }
});

async function cargarGasto(authorization: string | undefined, body: unknown): Promise<string> {
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!UUID.test(token)) throw unauthorized('token del atajo inválido');

  const { data: member, error: memberError } = await supabaseAdmin
    .from('couple_members')
    .select('user_id, couple_id')
    .eq('shortcut_token', token)
    .not('user_id', 'is', null)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw unauthorized('token del atajo inválido');

  const charge = parseShortcutPayload(body);
  if (!charge) throw badRequest('no se pudo leer el importe del pago');

  const date = todayAr();
  const { from, to } = dayWindow(date);

  const [pendingRes, accountsRes, rules] = await Promise.all([
    supabaseAdmin
      .from('fin_expenses')
      .select('id, amount, currency, expense_date, category_id, account_id')
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
  const accounts = accountsRes.data ?? [];

  const match = findMatchingRule(rules, { merchant: charge.merchant, description: charge.card });
  const fromEmail = (pendingRes.data ?? []).find((e) =>
    isSameCharge({ ...charge, date }, { amount: e.amount, currency: e.currency, date: e.expense_date }),
  );

  let accountId: string | null;
  let categoryId: string | null;
  if (fromEmail) {
    accountId = fromEmail.account_id;
    categoryId = fromEmail.category_id;
    const { error } = await supabaseAdmin
      .from('fin_expenses')
      .update({ status: 'confirmed', merchant: charge.merchant ?? undefined })
      .eq('id', fromEmail.id);
    if (error) throw error;
  } else {
    accountId = match?.account_id ?? matchAccount(charge.card, accounts);
    categoryId = match?.category_id ?? null;
    const { error } = await supabaseAdmin.from('fin_expenses').insert({
      couple_id: member.couple_id,
      user_id: member.user_id,
      account_id: accountId,
      category_id: categoryId,
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
  }

  let rubro: string | null = null;
  if (categoryId) {
    const { data } = await supabaseAdmin.from('fin_categories').select('name').eq('id', categoryId).maybeSingle();
    rubro = data?.name ?? null;
  }

  return mensajeAtajo({
    amount: charge.amount,
    currency: charge.currency,
    merchant: charge.merchant,
    rubro,
    cuenta: accounts.find((a) => a.id === accountId)?.name ?? null,
    confirmado: Boolean(fromEmail),
  });
}
