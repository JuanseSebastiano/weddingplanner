import { describe, expect, it } from 'vitest';
import { isCardStatement, parseCardStatement } from '../server/gmail/statements';
import type { NormalizedEmail } from '../server/gmail/parsers/types';

function email(from: string, subject: string, body: string): NormalizedEmail {
  return { id: 'm1', threadId: null, from, subject, body, receivedAt: null, snippet: '' };
}

describe('resúmenes de tarjeta', () => {
  it('lee los totales del mail de Galicia', () => {
    const e = email(
      'e-resumen@bancogalicia.com.ar',
      'Resumen de Tarjeta MasterCard',
      `| Hola, JUAN👋 |
| Ya está listo el resumen de tu tarjeta de crédito Mastercard |
| • Vencimiento: 11/11/2026 |
| • Total en pesos: 254.353,56 |
| • Total en dólares: 20,24 |
| • Pago mínimo: 26.200,00 |`,
    );
    expect(isCardStatement(e)).toBe(true);
    expect(parseCardStatement(e)).toEqual({
      card: 'Galicia Mastercard',
      due_date: '2026-11-11',
      total_ars: 254353.56,
      total_usd: 20.24,
      min_payment: 26200,
    });
  });

  it('lee "Importe a pagar en pesos/dólares" con símbolo', () => {
    const e = email(
      'Banco Santander <resumen@santander.com.ar>',
      'Resumen de Tarjeta de Credito con Vencimiento',
      'Resumen de tu tarjeta de crédito MasterCard. Detalle del resumen Importe a pagar en pesos $ 109.768,26 Importe a pagar en dólares U$S 0,00 Fecha de vencimiento: 10/11/2026',
    );
    expect(parseCardStatement(e)).toMatchObject({
      card: 'Santander Mastercard',
      total_ars: 109768.26,
      total_usd: 0,
      due_date: '2026-11-10',
    });
  });

  it('no toma como resumen el aviso de una compra', () => {
    const e = email('avisos@bancogalicia.com.ar', 'Realizaste una compra', 'Realizaste una compra por $ 1.000 en CAFE con tu tarjeta Visa');
    expect(isCardStatement(e)).toBe(false);
  });
});
