import { describe, expect, it } from 'vitest';
import { applyOperation, isBalanzBoletos, parseBalanzBoletos, type BalanzOperation } from '../server/gmail/balanz';
import { htmlToText } from '../server/gmail/message';
import { balanzBoletosHtml, balanzBoletosRealHtml, email } from './fixtures/emails';

const boletos = email({
  id: 'balanz-1',
  from: 'Balanz <notificaciones@balanz.com>',
  subject: 'Boletos',
  body: htmlToText(balanzBoletosHtml),
});

function op(tipo: BalanzOperation['tipo'], cantidad: number, neto: number, moneda: BalanzOperation['moneda'] = 'USD'): BalanzOperation {
  return { boleto: '1.000', tipo, ticker: 'AMZN', cantidad, neto, moneda };
}

describe('parseBalanzBoletos', () => {
  it('reconoce el mail de boletos', () => {
    expect(isBalanzBoletos(boletos)).toBe(true);
    expect(isBalanzBoletos({ ...boletos, from: 'otro@example.com' })).toBe(false);
  });

  it('lee las cuatro operaciones con su neto', () => {
    expect(parseBalanzBoletos(boletos)).toEqual([
      { boleto: '11.611.873', tipo: 'COMPRA', ticker: 'AMZN', cantidad: 259, neto: 495.72, moneda: 'USD' },
      { boleto: '11.611.872', tipo: 'VENTA', ticker: 'META', cantidad: 37, neto: 1219.78, moneda: 'USD' },
      { boleto: '11.611.875', tipo: 'COMPRA', ticker: 'ASML', cantidad: 40, neto: 495.71, moneda: 'USD' },
      { boleto: '11.611.874', tipo: 'COMPRA', ticker: 'NVDA', cantidad: 21, neto: 211.25, moneda: 'USD' },
    ]);
  });
});

describe('mail real de Balanz', () => {
  it('lee la venta y la compra del 26/10', () => {
    const real = email({
      from: 'Balanz <boletos@balanz.com>',
      subject: 'Resumen de boletos de las operaciones del día',
      body: htmlToText(balanzBoletosRealHtml),
    });
    expect(isBalanzBoletos(real)).toBe(true);
    expect(parseBalanzBoletos(real)).toEqual([
      { boleto: '12.135.252', tipo: 'VENTA', ticker: 'ADBE', cantidad: 187, neto: 1153.36, moneda: 'USD' },
      { boleto: '12.135.253', tipo: 'COMPRA', ticker: 'NU', cantidad: 176, neto: 1180.33, moneda: 'USD' },
    ]);
  });
});

describe('applyOperation', () => {
  it('crea la tenencia convirtiendo el neto con la MEP', () => {
    expect(applyOperation(null, op('COMPRA', 10, 100), 1500)).toEqual({ action: 'insert', quantity: 10, avg_cost: 15000 });
  });

  it('promedia el costo al comprar sobre una tenencia existente', () => {
    expect(applyOperation({ quantity: 10, avg_cost: 1000 }, op('COMPRA', 10, 30000, 'ARS'), 0)).toEqual({
      action: 'update',
      quantity: 20,
      avg_cost: 2000,
    });
  });

  it('una venta parcial resta sin tocar el costo', () => {
    expect(applyOperation({ quantity: 10, avg_cost: 1000 }, op('VENTA', 4, 50), 1500)).toEqual({
      action: 'update',
      quantity: 6,
      avg_cost: 1000,
    });
  });

  it('una venta total borra y una venta sin tenencia se saltea', () => {
    expect(applyOperation({ quantity: 4, avg_cost: 1000 }, op('VENTA', 4, 50), 1500)).toEqual({ action: 'delete' });
    expect(applyOperation(null, op('VENTA', 4, 50), 1500)).toEqual({ action: 'skip' });
  });
});
