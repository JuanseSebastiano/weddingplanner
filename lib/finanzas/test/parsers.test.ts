import { describe, expect, it } from 'vitest';
import { parseEmail } from '../server/gmail/parsers/index';
import { extractField, findAmount, findDate, findLast4, cleanMerchant } from '../server/gmail/parsers/common';
import { htmlToText, normalizeMessage } from '../server/gmail/message';
import {
  bbvaHtml,
  dolares,
  galiciaCompra,
  mercadoPagoPago,
  noRelacionado,
  santanderConsumo,
  sinMonto,
  visaAlertaDirecta,
} from './fixtures/emails';

describe('findAmount', () => {
  it('lee montos en formato argentino', () => {
    expect(findAmount('por $ 45.300,50 con tu tarjeta')).toEqual({ amount: 45300.5, currency: 'ARS' });
  });

  it('lee montos sin separador de miles', () => {
    expect(findAmount('total $1500')).toEqual({ amount: 1500, currency: 'ARS' });
  });

  it('distingue dólares', () => {
    expect(findAmount('consumo de USD 11,99')).toEqual({ amount: 11.99, currency: 'USD' });
  });

  it('devuelve null cuando no hay monto', () => {
    expect(findAmount('tu resumen ya está disponible')).toBeNull();
  });
});

describe('findDate', () => {
  it('lee dd/mm/yyyy como formato argentino', () => {
    expect(findDate('el día 03/07/2026')).toBe('2026-07-03');
  });

  it('lee fechas ISO', () => {
    expect(findDate('Fecha: 2026-07-12.')).toBe('2026-07-12');
  });

  it('lee fechas escritas en palabras', () => {
    expect(findDate('el 10 de julio de 2026')).toBe('2026-07-10');
  });

  it('completa el año faltante con el de referencia', () => {
    expect(findDate('el 05/03', 2026)).toBe('2026-03-05');
  });

  it('rechaza fechas imposibles', () => {
    expect(findDate('el 31/02/2026')).toBeNull();
  });
});

describe('findLast4', () => {
  it('reconoce "terminada en"', () => {
    expect(findLast4('tarjeta Visa terminada en 4321 el día')).toBe('4321');
  });

  it('reconoce el enmascarado con asteriscos', () => {
    expect(findLast4('Mastercard **** 8765')).toBe('8765');
  });

  it('devuelve null si no hay tarjeta', () => {
    expect(findLast4('transferencia recibida')).toBeNull();
  });
});

describe('extractField', () => {
  const text = 'Comercio: DLO*Rappi Pro\nMoneda: ARS\nMonto: 6490.00';

  it('lee el valor de un campo en su propia línea', () => {
    expect(extractField(text, 'Comercio')).toBe('DLO*Rappi Pro');
    expect(extractField(text, 'Monto')).toBe('6490.00');
  });

  it('no confunde un campo con otro que empieza igual', () => {
    // "Moneda" no debería devolver el resto de las líneas.
    expect(extractField(text, 'Moneda')).toBe('ARS');
  });

  it('devuelve null si el campo no aparece', () => {
    expect(extractField(text, 'Fecha')).toBeNull();
  });
});

describe('cleanMerchant', () => {
  it('normaliza los nombres en mayúsculas', () => {
    expect(cleanMerchant('COTO CICSA')).toBe('Coto Cicsa');
  });

  it('saca el sufijo societario', () => {
    expect(cleanMerchant('RAPPI ARGENTINA S.A.')).toBe('Rappi Argentina');
  });

  it('descarta cadenas demasiado cortas', () => {
    expect(cleanMerchant('A')).toBeNull();
  });
});

describe('parseEmail', () => {
  it('parsea un consumo de Santander', () => {
    const result = parseEmail(santanderConsumo);
    expect(result?.parser.id).toBe('santander');
    expect(result?.parsed).toMatchObject({
      amount: 45300.5,
      currency: 'ARS',
      date: '2026-07-14',
      last4: '4321',
    });
    expect(result?.parsed?.merchant).toContain('Coto');
  });

  it('parsea una compra de Galicia', () => {
    const result = parseEmail(galiciaCompra);
    expect(result?.parser.id).toBe('galicia');
    expect(result?.parsed).toMatchObject({
      amount: 12500,
      currency: 'ARS',
      merchant: 'Farmacity',
      date: '2026-07-03',
      last4: '8765',
    });
  });

  it('parsea un pago de Mercado Pago', () => {
    const result = parseEmail(mercadoPagoPago);
    expect(result?.parser.id).toBe('mercadopago');
    expect(result?.parsed?.amount).toBe(8750.25);
    expect(result?.parsed?.merchant).toContain('Ypf');
    expect(result?.parsed?.date).toBe('2026-07-10');
  });

  it('parsea un aviso de BBVA', () => {
    const result = parseEmail(bbvaHtml);
    expect(result?.parser.id).toBe('bbva');
    expect(result?.parsed).toMatchObject({
      amount: 6430,
      currency: 'ARS',
      date: '2026-07-12',
      last4: '9911',
    });
  });

  it('reconoce consumos en dólares', () => {
    const result = parseEmail(dolares);
    expect(result?.parsed).toMatchObject({ amount: 11.99, currency: 'USD' });
  });

  it('no inventa un monto cuando el mail no lo trae', () => {
    const result = parseEmail(sinMonto);
    expect(result?.parser.id).toBe('santander');
    expect(result?.parsed).toBeNull();
  });

  it('ignora mails que no son notificaciones de consumo', () => {
    expect(parseEmail(noRelacionado)).toBeNull();
  });

  it('parsea una alerta directa de Visa con campos en líneas separadas', () => {
    const result = parseEmail(visaAlertaDirecta);
    expect(result?.parser.id).toBe('visa');
    expect(result?.parsed).toMatchObject({
      amount: 6490,
      currency: 'ARS',
      merchant: 'DLO*Rappi Pro',
      last4: '7969',
    });
  });
});

describe('htmlToText', () => {
  it('convierte HTML a texto plano legible', () => {
    const html = '<div><p>Consumo en <b>COTO</b></p><p>Total: $1.000,00</p></div>';
    const text = htmlToText(html);
    expect(text).toContain('Consumo en COTO');
    expect(text).toContain('$1.000,00');
    expect(text).not.toContain('<');
  });

  it('decodifica entidades', () => {
    expect(htmlToText('<p>Caf&eacute;&nbsp;&amp; Bar</p>')).toContain('& Bar');
  });
});

describe('normalizeMessage', () => {
  it('extrae headers y cuerpo de la estructura MIME de Gmail', () => {
    const body = Buffer.from('Consumo en COTO por $ 1.234,56').toString('base64url');
    const normalized = normalizeMessage({
      id: 'abc',
      threadId: 'thread',
      internalDate: '1784000000000',
      snippet: 'Consumo en COTO',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'Santander <alertas@santander.com.ar>' },
          { name: 'Subject', value: 'Consumo con tu tarjeta' },
        ],
        parts: [{ mimeType: 'text/plain', body: { data: body } }],
      },
    });

    expect(normalized.from).toContain('santander.com.ar');
    expect(normalized.subject).toBe('Consumo con tu tarjeta');
    expect(normalized.body).toContain('$ 1.234,56');
    expect(normalized.receivedAt).toBeInstanceOf(Date);
  });

  it('usa el HTML cuando no hay parte de texto plano', () => {
    const html = Buffer.from('<p>Compra en <b>JUMBO</b> por $999,00</p>').toString('base64url');
    const normalized = normalizeMessage({
      id: 'def',
      payload: {
        mimeType: 'text/html',
        headers: [{ name: 'From', value: 'x@y.com' }],
        body: { data: html },
      },
    });

    expect(normalized.body).toContain('JUMBO');
    expect(normalized.body).not.toContain('<p>');
  });
});
