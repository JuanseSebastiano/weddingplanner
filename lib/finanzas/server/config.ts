/**
 * Lee la variable y le saca los espacios de los bordes. El trim no es
 * cosmético: pegar un client secret en el panel de Vercel arrastra muy
 * fácil un espacio o un salto de línea, y Google responde a eso con un
 * `invalid_client` que no dice nada sobre la causa real.
 */
function env(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function required(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Cargala en .env.local o en Vercel (ver README).`,
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return env(name) ?? fallback;
}

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/** "http://a.com, https://b.com" -> ["http://a.com", "https://b.com"] */
function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * URLs que Vercel inyecta sola en cada despliegue. Sirven de default para
 * que el redirect del OAuth de Gmail no caiga en localhost cuando nadie
 * cargó WEB_ORIGIN a mano. `VERCEL_PROJECT_PRODUCTION_URL` es estable;
 * `VERCEL_URL` es la del deploy puntual (cambia en cada preview).
 */
function vercelOrigins(): string[] {
  return [env('VERCEL_PROJECT_PRODUCTION_URL'), env('VERCEL_URL')]
    .filter((host): host is string => Boolean(host))
    .map((host) => (host.startsWith('http') ? host : `https://${host}`));
}

const webOrigins = parseOrigins(
  optional('WEB_ORIGIN', [...vercelOrigins(), DEFAULT_WEB_ORIGIN].join(',')),
);

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),

  // Getters: se leen al primer uso y no al importar, así `next build` no
  // exige la service role key para compilar.
  supabase: {
    get url() {
      return required('NEXT_PUBLIC_SUPABASE_URL');
    },
    get serviceRoleKey() {
      return required('SUPABASE_SERVICE_ROLE_KEY');
    },
  },

  web: {
    /** Primero de la lista: a donde se vuelve tras el OAuth de Gmail. */
    origin: webOrigins[0] ?? DEFAULT_WEB_ORIGIN,
  },

  gmail: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    redirectUri: optional('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/fin/gmail/oauth/callback'),
    /**
     * Query de Gmail que acota qué mails se leen.
     *
     * Por defecto busca los emisores para los que ya hay un parser, así
     * la sincronización encuentra algo desde el primer día sin que el
     * usuario tenga que crear y aplicar a mano una etiqueta en Gmail. Si
     * definís GMAIL_SEARCH_QUERY, reemplaza esto por completo — sirve para
     * acotar a `label:BANCOS` si preferís curar vos qué se lee, o para
     * sumar el dominio de un banco que no está en esta lista.
     */
    searchQuery: optional(
      'GMAIL_SEARCH_QUERY',
      '(label:BANCOS OR from:(visa.com OR santander.com.ar OR bancogalicia.com.ar OR bbva.com.ar OR mercadopago.com OR naranja.com OR naranjax.com))',
    ),
    /** Clave hex de 32 bytes para cifrar el refresh token (AES-256-GCM). */
    encryptionKey: optional('GMAIL_TOKEN_ENCRYPTION_KEY'),
    /** Secreto compartido que valida el webhook de Pub/Sub. */
    webhookSecret: optional('GMAIL_WEBHOOK_SECRET'),
    /**
     * Secreto del cron. Vercel manda `Authorization: Bearer $CRON_SECRET`
     * en cada disparo si la variable está definida en el proyecto.
     */
    cronSecret: optional('CRON_SECRET'),
    /** Cuántos mails procesa como máximo una corrida de sync. */
    maxMessagesPerSync: Number(process.env.GMAIL_MAX_MESSAGES_PER_SYNC ?? 50),
  },
} as const;

/** La ingesta de mails es opcional: la app funciona sin Gmail configurado. */
export function isGmailConfigured(): boolean {
  return Boolean(config.gmail.clientId && config.gmail.clientSecret && config.gmail.encryptionKey);
}
