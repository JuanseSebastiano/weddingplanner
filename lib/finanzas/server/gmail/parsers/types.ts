/** Mail normalizado que reciben los parsers (ver gmail/message.ts). */
export interface NormalizedEmail {
  id: string;
  threadId: string | null;
  from: string;
  subject: string;
  /** Cuerpo en texto plano; si el mail era HTML, ya viene destageado. */
  body: string;
  receivedAt: Date | null;
  snippet: string;
}

export interface ParsedNotification {
  amount: number;
  currency: string;
  merchant: string | null;
  /** Fecha del consumo, formato YYYY-MM-DD. */
  date: string | null;
  /** Últimos 4 dígitos de la tarjeta, si el mail los informa. */
  last4: string | null;
}

export interface EmailParser {
  /** Identificador que queda guardado en email_ingestion_log.parser_id. */
  id: string;
  /** Nombre legible del emisor, para mostrar en la vista de revisión. */
  label: string;
  /** Decide rápido si este parser aplica al mail (por remitente/asunto). */
  matches: (email: NormalizedEmail) => boolean;
  /** Devuelve null si el mail matchea el emisor pero no se pudo extraer el dato. */
  parse: (email: NormalizedEmail) => ParsedNotification | null;
}
