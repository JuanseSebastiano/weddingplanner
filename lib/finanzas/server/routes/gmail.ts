import { Router } from '../http';
import { z } from 'zod';
import { config, isGmailConfigured } from '../config';
import { asyncHandler, badRequest, HttpError, unauthorized } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { buildAuthUrl, disconnect, exchangeCodeAndStore, loadCredential, loadCredentialByAddress, verifyState } from '../gmail/oauth';
import { syncAllUsers, syncUser, syncUserById } from '../gmail/sync';

export const gmailRouter = Router();

/** Estado de la conexión del usuario. */
gmailRouter.get(
  '/status',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const credential = await loadCredential(req.auth.userId);
    res.json({
      available: isGmailConfigured(),
      connected: Boolean(credential),
      address: credential?.gmail_address ?? null,
      last_synced_at: credential?.last_synced_at ?? null,
      query: config.gmail.searchQuery,
    });
  }),
);

/**
 * Devuelve la URL de consentimiento de Google. El frontend redirige ahí.
 * No se hace el redirect desde acá porque la llamada lleva el Bearer token.
 */
gmailRouter.post(
  '/oauth/start',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json({ url: buildAuthUrl(req.auth.userId) });
  }),
);

/**
 * Callback de Google. Llega sin sesión: el usuario se identifica con el
 * `state` firmado (ver gmail/oauth.ts).
 */
gmailRouter.get(
  '/oauth/callback',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    });

    /**
     * Siempre se vuelve al frontend, también cuando algo falla: este
     * endpoint lo abre Google en la barra de direcciones, así que un JSON
     * de error dejaría al usuario mirando `{"error": ...}` sin forma de
     * volver ni de saber qué pasó.
     */
    const back = (params: Record<string, string>): void => {
      const redirect = new URL('/finanzas/configuracion', config.web.origin);
      for (const [name, value] of Object.entries(params)) {
        redirect.searchParams.set(name, value);
      }
      res.redirect(redirect.toString());
    };

    try {
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        const description =
          typeof req.query.error === 'string' ? req.query.error : 'faltan code/state';
        throw badRequest(`Google no completó la autorización (${description})`);
      }

      const userId = verifyState(parsed.data.state);
      const credential = await exchangeCodeAndStore(parsed.data.code, userId);

      back({ gmail: 'conectado', address: credential.gmailAddress });
    } catch (err) {
      console.error('[gmail:oauth/callback]', err);
      back({
        gmail: 'error',
        motivo:
          err instanceof HttpError
            ? err.message
            : 'No pudimos completar la conexión con Google. Revisá los logs del servidor.',
      });
    }
  }),
);

gmailRouter.delete(
  '/connection',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    await disconnect(req.auth.userId);
    res.status(204).end();
  }),
);

/** Sincronización manual desde la UI ("Buscar gastos nuevos"). */
gmailRouter.post(
  '/sync',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = await syncUserById(req.auth.userId);
    res.json(result);
  }),
);

/**
 * Disparador de Vercel Cron: sincroniza todas las casillas conectadas.
 *
 * Vercel agrega `Authorization: Bearer $CRON_SECRET` a cada llamada cuando
 * esa variable existe en el proyecto. Sin el secreto configurado el
 * endpoint queda cerrado, para que nadie de afuera pueda dispararlo.
 */
gmailRouter.get(
  '/cron',
  asyncHandler(async (req, res) => {
    if (!config.gmail.cronSecret) {
      throw badRequest('El cron no está habilitado (falta CRON_SECRET)');
    }
    if (req.header('authorization') !== `Bearer ${config.gmail.cronSecret}`) {
      throw unauthorized('Token del cron inválido');
    }
    if (!isGmailConfigured()) {
      throw badRequest('La ingesta de Gmail no está configurada en el servidor');
    }

    const results = await syncAllUsers();
    const totals = results.reduce(
      (acc, r) => ({
        scanned: acc.scanned + r.scanned,
        created: acc.created + r.created,
        duplicates: acc.duplicates + r.duplicates,
        failed: acc.failed + r.failed,
      }),
      { scanned: 0, created: 0, duplicates: 0, failed: 0 },
    );

    console.log('[gmail:cron]', JSON.stringify(totals), `casillas=${results.length}`);
    res.json({ mailboxes: results.length, ...totals, results });
  }),
);

/** Últimos mails procesados, para diagnosticar parseos fallidos. */
gmailRouter.get(
  '/log',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('fin_email_ingestion_log')
      .select('*')
      .eq('user_id', req.auth.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data ?? []);
  }),
);

/**
 * Webhook de Pub/Sub (push de Gmail watch). Google manda el mensaje
 * base64 con `{emailAddress, historyId}`; acá solo dispara el sync del
 * usuario correspondiente.
 *
 * La autenticación es un secreto compartido en la query string
 * (`?token=...`), que se configura al crear la suscripción push.
 * Si no configurás Pub/Sub, alcanza con el job `npm run gmail:sync`.
 */
gmailRouter.post(
  '/notifications',
  asyncHandler(async (req, res) => {
    if (!config.gmail.webhookSecret) {
      throw badRequest('El webhook no está habilitado (falta GMAIL_WEBHOOK_SECRET)');
    }
    if (req.query.token !== config.gmail.webhookSecret) {
      throw unauthorized('Token del webhook inválido');
    }

    const schema = z.object({
      message: z.object({ data: z.string().optional() }).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success || !parsed.data.message?.data) {
      // Pub/Sub reintenta si no respondemos 2xx; un payload raro no debe
      // generar reintentos infinitos.
      res.status(204).end();
      return;
    }

    let payload: { emailAddress?: string };
    try {
      payload = JSON.parse(Buffer.from(parsed.data.message.data, 'base64').toString('utf8'));
    } catch {
      res.status(204).end();
      return;
    }

    if (!payload.emailAddress) {
      res.status(204).end();
      return;
    }

    const credential = await loadCredentialByAddress(payload.emailAddress);
    if (!credential) {
      res.status(204).end();
      return;
    }

    const result = await syncUser(credential);
    res.json(result);
  }),
);
