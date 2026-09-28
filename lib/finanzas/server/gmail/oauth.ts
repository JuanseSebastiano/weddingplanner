import { createHmac, timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import type { Credentials, OAuth2Client } from 'google-auth-library';
import { config, isGmailConfigured } from '../config';
import { supabaseAdmin } from '../lib/supabase';
import { decryptToken, encryptToken } from '../lib/crypto';
import { badRequest, HttpError } from '../lib/errors';

/** Solo lectura: la app nunca modifica ni envía mails. */
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function createOAuthClient(): OAuth2Client {
  if (!isGmailConfigured()) {
    throw new HttpError(
      503,
      'La ingesta de Gmail no está configurada en el servidor (ver GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GMAIL_TOKEN_ENCRYPTION_KEY).',
    );
  }
  return new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri,
  );
}

/**
 * El parámetro `state` de OAuth lleva el user_id firmado con HMAC: el
 * callback de Google no trae sesión, así que es la única forma de saber
 * a qué usuario pertenece el token que vuelve.
 */
export function signState(userId: string): string {
  const secret = config.gmail.encryptionKey;
  const signature = createHmac('sha256', secret).update(userId).digest('hex');
  return Buffer.from(`${userId}:${signature}`).toString('base64url');
}

export function verifyState(state: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(state, 'base64url').toString('utf8');
  } catch {
    throw badRequest('Parámetro state inválido');
  }

  const separator = decoded.lastIndexOf(':');
  if (separator < 0) throw badRequest('Parámetro state inválido');

  const userId = decoded.slice(0, separator);
  const signature = decoded.slice(separator + 1);
  const expected = createHmac('sha256', config.gmail.encryptionKey).update(userId).digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw badRequest('El parámetro state no es válido o fue manipulado');
  }
  return userId;
}

export function buildAuthUrl(userId: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    // 'consent' fuerza que Google devuelva refresh_token también cuando el
    // usuario ya autorizó la app antes.
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: signState(userId),
  });
}

export interface StoredCredential {
  userId: string;
  gmailAddress: string;
  refreshToken: string;
  historyId: string | null;
}

/**
 * Traduce el rechazo del token endpoint de Google a algo accionable.
 *
 * Google contesta con un código corto (`invalid_client`,
 * `redirect_uri_mismatch`, …) que viaja adentro de un GaxiosError. Sin
 * esta traducción el usuario ve "Error interno del servidor" y el motivo
 * real queda sólo en los logs.
 */
function tokenExchangeError(err: unknown): HttpError {
  const data = (err as { response?: { data?: { error?: string; error_description?: string } } })
    ?.response?.data;
  const code = data?.error;

  const messages: Record<string, string> = {
    invalid_client:
      'Google rechazó las credenciales de la app (invalid_client). Revisá GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor: tienen que ser los del mismo cliente OAuth y el secreto tiene que ser el vigente.',
    redirect_uri_mismatch: `La URI de redirección no coincide con la del cliente OAuth. Cargá exactamente "${config.gmail.redirectUri}" en Google Cloud → Credenciales → Authorized redirect URIs.`,
    invalid_grant:
      'El código de autorización venció o ya se había usado. Volvé a apretar "Conectar mi Gmail".',
    unauthorized_client:
      'El cliente OAuth no tiene habilitado este tipo de autorización. Revisá que sea un cliente de tipo "Aplicación web" en Google Cloud.',
    invalid_request: `Google rechazó el pedido de token${data?.error_description ? ` (${data.error_description})` : ''}.`,
  };

  if (code && messages[code]) return new HttpError(502, messages[code]);
  return new HttpError(
    502,
    `Google rechazó el intercambio del código${code ? ` (${code})` : ''}. Revisá la configuración del cliente OAuth.`,
  );
}

export async function exchangeCodeAndStore(code: string, userId: string): Promise<StoredCredential> {
  const client = createOAuthClient();

  let tokens: Credentials;
  try {
    ({ tokens } = await client.getToken(code));
  } catch (err) {
    console.error('[gmail:oauth] falló el intercambio del código:', err);
    throw tokenExchangeError(err);
  }

  if (!tokens.refresh_token) {
    throw badRequest(
      'Google no devolvió refresh token. Revocá el acceso de la app en myaccount.google.com/permissions y volvé a conectar.',
    );
  }

  client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const address = profile.data.emailAddress ?? '';
  const historyId = profile.data.historyId ?? null;

  const { error } = await supabaseAdmin.from('fin_gmail_credentials').upsert(
    {
      user_id: userId,
      gmail_address: address,
      refresh_token_enc: encryptToken(tokens.refresh_token),
      history_id: historyId,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;

  return { userId, gmailAddress: address, refreshToken: tokens.refresh_token, historyId };
}

export interface GmailCredentialRow {
  user_id: string;
  gmail_address: string;
  refresh_token_enc: string;
  history_id: string | null;
  last_synced_at: string | null;
}

export async function loadCredential(userId: string): Promise<GmailCredentialRow | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_gmail_credentials')
    .select('user_id, gmail_address, refresh_token_enc, history_id, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as GmailCredentialRow) ?? null;
}

export async function loadCredentialByAddress(address: string): Promise<GmailCredentialRow | null> {
  const { data, error } = await supabaseAdmin
    .from('fin_gmail_credentials')
    .select('user_id, gmail_address, refresh_token_enc, history_id, last_synced_at')
    .eq('gmail_address', address)
    .maybeSingle();

  if (error) throw error;
  return (data as GmailCredentialRow) ?? null;
}

export async function listCredentials(): Promise<GmailCredentialRow[]> {
  const { data, error } = await supabaseAdmin
    .from('fin_gmail_credentials')
    .select('user_id, gmail_address, refresh_token_enc, history_id, last_synced_at');

  if (error) throw error;
  return (data ?? []) as GmailCredentialRow[];
}

/** Cliente OAuth autenticado como el usuario, listo para llamar a la API. */
export function authorizedClient(credential: GmailCredentialRow): OAuth2Client {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: decryptToken(credential.refresh_token_enc) });
  return client;
}

export async function disconnect(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('fin_gmail_credentials').delete().eq('user_id', userId);
  if (error) throw error;
}
