import type { NormalizedEmail } from '../../server/gmail/parsers/types';

/**
 * Mails de ejemplo con el formato típico de cada emisor.
 * Los textos están escritos a mano imitando notificaciones reales:
 * al sumar un banco nuevo, pegá acá un mail real anonimizado.
 */

export function email(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    from: 'Notificaciones <avisos@example.com>',
    subject: '',
    body: '',
    receivedAt: new Date('2026-07-15T14:30:00Z'),
    snippet: '',
    ...overrides,
  };
}

export const santanderConsumo = email({
  id: 'santander-1',
  from: 'Santander <alertas@santander.com.ar>',
  subject: 'Consumo con tu tarjeta de crédito',
  body: `Hola Juan,

Te informamos que se registró un consumo en COTO CICSA por $ 45.300,50
con tu tarjeta Visa terminada en 4321 el día 14/07/2026.

Si no reconocés esta operación, comunicate al 0810-333-2400.`,
  snippet: 'Se registró un consumo en COTO CICSA por $ 45.300,50',
});

export const galiciaCompra = email({
  id: 'galicia-1',
  from: 'Banco Galicia <notificaciones@bancogalicia.com.ar>',
  subject: 'Realizaste una compra',
  body: `Realizaste una compra por $12.500,00 en FARMACITY el 03/07/2026 con tu
tarjeta Mastercard **** 8765.`,
  snippet: 'Realizaste una compra por $12.500,00 en FARMACITY',
});

export const mercadoPagoPago = email({
  id: 'mp-1',
  from: 'Mercado Pago <no-responder@mercadopago.com>',
  subject: 'Pagaste $8.750,25 en YPF',
  body: `Hola, pagaste $8.750,25 a YPF SERVICIOS el 10 de julio de 2026
con tu tarjeta terminada en 4321.`,
  snippet: 'Pagaste $8.750,25 en YPF',
});

export const bbvaHtml = email({
  id: 'bbva-1',
  from: 'BBVA <avisos@bbva.com.ar>',
  subject: 'Aviso de consumo',
  body: `Consumo registrado. Comercio: RAPPI ARGENTINA. Importe: ARS 6.430,00.
Fecha: 2026-07-12. Tarjeta terminada en 9911.`,
  snippet: 'Consumo registrado en RAPPI ARGENTINA',
});

export const dolares = email({
  id: 'usd-1',
  from: 'Santander <alertas@santander.com.ar>',
  subject: 'Consumo en el exterior',
  body: `Se registró un consumo en SPOTIFY por USD 11,99 con tu tarjeta
terminada en 4321 el día 05/07/2026.`,
  snippet: 'Consumo en SPOTIFY por USD 11,99',
});

/**
 * Alerta directa de Visa (no de un banco puntual): los datos van en líneas
 * "Campo: valor" separadas, con la moneda y el monto en renglones distintos.
 */
export const visaAlertaDirecta = email({
  id: 'visa-1',
  from: 'Alerta de Compras Visa <DoNotReplyAlertadeComprasVisa@visa.com>',
  subject: 'Alerta de Compras Visa',
  body: `Su tarjeta Visa con terminación 7969 se acaba de usar en línea o por teléfono para la siguiente transacción:

Comercio: DLO*Rappi Pro
País: ARG
Ciudad: CABA
Tarjeta: 7969
Autorización: 006199
Referencia: True
Tipo de transacción: Compra
Moneda: ARS
Monto: 6490.00

Si no reconoce esta transacción, por favor llame de inmediato al número de servicio al cliente que figura al dorso de su tarjeta Visa.`,
  snippet: 'Su tarjeta Visa con terminación 7969 se acaba de usar en línea o por teléfono',
});

/** Mail de un banco reconocido pero que no informa ningún monto. */
export const sinMonto = email({
  id: 'sin-monto-1',
  from: 'Santander <alertas@santander.com.ar>',
  subject: 'Tu resumen de cuenta ya está disponible',
  body: 'Ingresá a Online Banking para ver el resumen del mes.',
  snippet: 'Tu resumen ya está disponible',
});

/** Newsletter cualquiera: no debe generar ningún gasto. */
export const noRelacionado = email({
  id: 'spam-1',
  from: 'Newsletter <hola@tienda.com>',
  subject: 'Nuevos productos de la semana',
  body: 'Mirá las novedades que preparamos para vos.',
  snippet: 'Nuevos productos de la semana',
});

/** Boletos de Balanz: tabla HTML con una fila por operación (datos de un mail real). */
const balanzFila = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

export const balanzBoletosHtml = `<html><body>
<h1>Boletos</h1>
<p>Operaciones concertadas el <b>13/10/2026</b></p>
<p>Comitente: <b>SEBASTIANO JUAN SEGUNDO</b></p><p>Número: <b>481.349</b></p>
<table>
${balanzFila(['#Boleto', 'Tipo', 'Ticker', 'Descripción', 'Cant.', 'Precio', 'Bruto', 'Arancel', 'IVA', 'Der. Mercado', 'Neto', 'Moneda', 'Fecha Liqui.'])}
${balanzFila(['11.611.873', 'COMPRA', 'AMZN', 'CEDEAR AMAZON.COM, INC', '259', 'usd 1,895', 'usd 490,81', 'usd 4,91', '$ 1.642,36', '$ 372,28', 'usd 495,72', 'Dólar MEP', '14/10/2026'])}
${balanzFila(['11.611.872', 'VENTA', 'META', 'CEDEAR META PLATFORMS INC.', '37', 'usd 33,30', 'usd 1.232,10', 'usd 12,32', '$ 4.121,03', '$ 934,55', 'usd 1.219,78', 'Dólar MEP', '14/10/2026'])}
${balanzFila(['11.611.875', 'COMPRA', 'ASML', 'CEDEAR ASML HOLDING NV', '40', 'usd 12,27', 'usd 490,80', 'usd 4,91', '$ 1.642,36', '$ 372,27', 'usd 495,71', 'Dólar MEP', '14/10/2026'])}
${balanzFila(['11.611.874', 'COMPRA', 'NVDA', 'CEDEAR NVIDIA CORPORATION', '21', 'usd 9,96', 'usd 209,16', 'usd 2,09', '$ 699,13', '$ 158,64', 'usd 211,25', 'Dólar MEP', '14/10/2026'])}
</table>
<p>Desde la plataforma web tendrás acceso a más información de estas operaciones.</p>
</body></html>`;
