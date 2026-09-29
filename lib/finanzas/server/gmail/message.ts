import type { gmail_v1 } from 'googleapis';
import type { NormalizedEmail } from './parsers/types';

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** Convierte HTML a texto plano legible para los parsers. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|td|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Recorre el árbol MIME y arma el cuerpo, prefiriendo text/plain. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  const plain: string[] = [];
  const html: string[] = [];

  const walk = (part: gmail_v1.Schema$MessagePart): void => {
    const data = part.body?.data;
    if (data) {
      const decoded = decodeBase64Url(data);
      if (part.mimeType === 'text/plain') plain.push(decoded);
      else if (part.mimeType === 'text/html') html.push(decoded);
    }
    for (const child of part.parts ?? []) walk(child);
  };

  walk(payload);

  if (plain.length > 0) return plain.join('\n').trim();
  if (html.length > 0) return htmlToText(html.join('\n'));
  return '';
}

function header(message: gmail_v1.Schema$Message, name: string): string {
  const headers = message.payload?.headers ?? [];
  const found = headers.find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase());
  return found?.value ?? '';
}

export function normalizeMessage(message: gmail_v1.Schema$Message): NormalizedEmail {
  const internalDate = message.internalDate ? Number(message.internalDate) : null;

  return {
    id: message.id ?? '',
    threadId: message.threadId ?? null,
    from: header(message, 'From'),
    subject: header(message, 'Subject'),
    body: extractBody(message.payload),
    receivedAt: internalDate ? new Date(internalDate) : null,
    snippet: message.snippet ?? '',
  };
}
