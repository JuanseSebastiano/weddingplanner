import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function key(): Buffer {
  const hex = config.gmail.encryptionKey;
  if (!hex) {
    throw new Error(
      'Falta GMAIL_TOKEN_ENCRYPTION_KEY. Generala con: openssl rand -hex 32',
    );
  }
  const buffer = Buffer.from(hex, 'hex');
  if (buffer.length !== 32) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY debe ser de 32 bytes en hexadecimal (64 caracteres)');
  }
  return buffer;
}

/**
 * Cifra el refresh token de Gmail antes de guardarlo.
 * Formato: "iv:authTag:ciphertext", los tres en base64.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('El token cifrado tiene un formato inválido');
  }
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
