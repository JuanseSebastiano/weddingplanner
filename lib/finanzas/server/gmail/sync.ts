import { google } from 'googleapis';
import { config } from '../config';
import { supabaseAdmin } from '../lib/supabase';
import { authorizedClient, listCredentials, loadCredential, type GmailCredentialRow } from './oauth';
import { normalizeMessage } from './message';
import { parseEmail } from './parsers/index';
import type { NormalizedEmail, ParsedNotification } from './parsers/types';
import { findMatchingRule, loadRules } from '../services/rules-engine';

export interface SyncResult {
  user_id: string;
  gmail_address: string;
  scanned: number;
  created: number;
  duplicates: number;
  failed: number;
  errors: string[];
}

interface UserContext {
  userId: string;
  coupleId: string;
  /** Cuentas del usuario indexadas por últimos 4 dígitos, para el matcheo. */
  accountsByLast4: Map<string, string>;
  defaultAccountId: string | null;
}

async function loadUserContext(userId: string): Promise<UserContext | null> {
  const { data: profile, error } = await supabaseAdmin
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile?.couple_id) return null;

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('fin_accounts')
    .select('id, last4, active')
    .eq('owner_id', userId)
    .eq('active', true);

  if (accountsError) throw accountsError;

  const rows = (accounts ?? []) as Array<{ id: string; last4: string | null }>;
  const accountsByLast4 = new Map<string, string>();
  for (const account of rows) {
    if (account.last4) accountsByLast4.set(account.last4, account.id);
  }

  return {
    userId,
    coupleId: profile.couple_id as string,
    accountsByLast4,
    // Con una sola cuenta no hace falta adivinar: se imputa a esa.
    defaultAccountId: rows.length === 1 ? (rows[0]?.id ?? null) : null,
  };
}

/** ¿Este mail ya fue procesado antes? La unicidad real la impone la BD. */
async function alreadyIngested(userId: string, messageId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('fin_email_ingestion_log')
    .select('id')
    .eq('user_id', userId)
    .eq('gmail_message_id', messageId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function logIngestion(
  context: UserContext,
  email: NormalizedEmail,
  fields: {
    parser_id: string | null;
    parse_status: 'parsed' | 'failed' | 'duplicate' | 'ignored';
    parsed?: ParsedNotification | null;
    matched_account_id?: string | null;
    error_detail?: string | null;
  },
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_email_ingestion_log')
    .insert({
      user_id: context.userId,
      couple_id: context.coupleId,
      gmail_message_id: email.id,
      gmail_thread_id: email.threadId,
      from_address: email.from.slice(0, 300),
      subject: email.subject.slice(0, 500),
      received_at: email.receivedAt?.toISOString() ?? null,
      raw_snippet: email.snippet.slice(0, 1000),
      parser_id: fields.parser_id,
      parse_status: fields.parse_status,
      parsed_amount: fields.parsed?.amount ?? null,
      parsed_currency: fields.parsed?.currency ?? null,
      parsed_merchant: fields.parsed?.merchant ?? null,
      parsed_date: fields.parsed?.date ?? null,
      matched_account_id: fields.matched_account_id ?? null,
      error_detail: fields.error_detail ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 = otro proceso ingirió el mismo mail primero.
    if (error.code === '23505') return null;
    throw error;
  }
  return data.id as string;
}

/**
 * Procesa un mail: lo parsea y, si sale bien, crea el gasto en estado
 * `pending`. Nunca se imputa directo — la confirmación del usuario en la
 * vista de revisión es lo que evita que un parseo errado ensucie los datos.
 */
export async function ingestEmail(
  context: UserContext,
  email: NormalizedEmail,
): Promise<'created' | 'duplicate' | 'failed'> {
  if (await alreadyIngested(context.userId, email.id)) return 'duplicate';

  const result = parseEmail(email);

  if (!result) {
    await logIngestion(context, email, {
      parser_id: null,
      parse_status: 'ignored',
      error_detail: 'Ningún parser reconoció el remitente',
    });
    return 'failed';
  }

  if (!result.parsed) {
    await logIngestion(context, email, {
      parser_id: result.parser.id,
      parse_status: 'failed',
      error_detail: 'El parser no encontró un monto en el mail',
    });
    return 'failed';
  }

  const parsed = result.parsed;
  const accountId =
    (parsed.last4 ? context.accountsByLast4.get(parsed.last4) : undefined) ??
    context.defaultAccountId;

  const ingestionId = await logIngestion(context, email, {
    parser_id: result.parser.id,
    parse_status: 'parsed',
    parsed,
    matched_account_id: accountId ?? null,
  });

  // Otro proceso lo tomó entre el chequeo y el insert.
  if (!ingestionId) return 'duplicate';

  // Las reglas proponen un rubro; el usuario lo puede cambiar al confirmar.
  const rules = await loadRules(context.coupleId);
  const match = findMatchingRule(rules, {
    merchant: parsed.merchant,
    description: email.subject,
    sender: email.from,
  });

  const { data: expense, error } = await supabaseAdmin
    .from('fin_expenses')
    .insert({
      couple_id: context.coupleId,
      user_id: context.userId,
      account_id: match?.account_id ?? accountId ?? null,
      category_id: match?.category_id ?? null,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      description: email.subject.slice(0, 500),
      expense_date: parsed.date ?? new Date().toISOString().slice(0, 10),
      source: 'email',
      status: 'pending',
      email_ingestion_id: ingestionId,
      applied_rule_id: match?.rule.id ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;

  const { error: linkError } = await supabaseAdmin
    .from('fin_email_ingestion_log')
    .update({ expense_id: expense.id })
    .eq('id', ingestionId);

  if (linkError) throw linkError;
  return 'created';
}

/**
 * Sincroniza la casilla de un usuario.
 *
 * Usa `messages.list` con la query configurada (por defecto `label:BANCOS`),
 * acotada a los mails posteriores a la última corrida. El history_id se
 * guarda para poder migrar a `history.list` incremental sin cambiar el
 * modelo de datos.
 */
export async function syncUser(credential: GmailCredentialRow): Promise<SyncResult> {
  const result: SyncResult = {
    user_id: credential.user_id,
    gmail_address: credential.gmail_address,
    scanned: 0,
    created: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
  };

  const context = await loadUserContext(credential.user_id);
  if (!context) {
    result.errors.push('El usuario no pertenece a ningún hogar');
    return result;
  }

  const auth = authorizedClient(credential);
  const gmail = google.gmail({ version: 'v1', auth });

  // Ventana de seguridad: se relee un día hacia atrás por si un mail llegó
  // con retraso. El dedup por gmail_message_id evita duplicados.
  const since = credential.last_synced_at
    ? new Date(new Date(credential.last_synced_at).getTime() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const query = `${config.gmail.searchQuery} after:${Math.floor(since.getTime() / 1000)}`;

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: config.gmail.maxMessagesPerSync,
  });

  const messages = list.data.messages ?? [];

  for (const stub of messages) {
    if (!stub.id) continue;
    result.scanned += 1;

    try {
      const full = await gmail.users.messages.get({ userId: 'me', id: stub.id, format: 'full' });
      const email = normalizeMessage(full.data);
      const outcome = await ingestEmail(context, email);

      if (outcome === 'created') result.created += 1;
      else if (outcome === 'duplicate') result.duplicates += 1;
      else result.failed += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push(`${stub.id}: ${(err as Error).message}`);
    }
  }

  const profile = await gmail.users.getProfile({ userId: 'me' });
  const { error } = await supabaseAdmin
    .from('fin_gmail_credentials')
    .update({
      last_synced_at: new Date().toISOString(),
      history_id: profile.data.historyId ?? credential.history_id,
    })
    .eq('user_id', credential.user_id);

  if (error) throw error;
  return result;
}

/**
 * Sincroniza todas las casillas conectadas. La usan el job de línea de
 * comandos y el endpoint de cron: un fallo en una casilla no frena al
 * resto, se reporta en el resultado de esa casilla.
 */
export async function syncAllUsers(): Promise<SyncResult[]> {
  const credentials = await listCredentials();
  const results: SyncResult[] = [];

  for (const credential of credentials) {
    try {
      results.push(await syncUser(credential));
    } catch (err) {
      results.push({
        user_id: credential.user_id,
        gmail_address: credential.gmail_address,
        scanned: 0,
        created: 0,
        duplicates: 0,
        failed: 0,
        errors: [(err as Error).message],
      });
    }
  }

  return results;
}

export async function syncUserById(userId: string): Promise<SyncResult> {
  const credential = await loadCredential(userId);
  if (!credential) {
    return {
      user_id: userId,
      gmail_address: '',
      scanned: 0,
      created: 0,
      duplicates: 0,
      failed: 0,
      errors: ['El usuario no tiene Gmail conectado'],
    };
  }
  return syncUser(credential);
}
