import { describe, expect, it } from 'vitest';
import { dayWindow, isSameCharge, matchAccount, mensajeAtajo, parseShortcutPayload, todayAr } from '../server/services/shortcut';

const ACCOUNTS = [
  { id: 'visa', name: 'Visa Galicia', last4: '1234' },
  { id: 'amex', name: 'Amex', last4: null },
];

describe('parseShortcutPayload', () => {
  it('lee importes en formato argentino', () => {
    expect(parseShortcutPayload({ amount: '$ 1.234,56', merchant: 'FARMACITY', card: 'Visa' })).toEqual({
      amount: 1234.56,
      currency: 'ARS',
      merchant: 'Farmacity',
      card: 'Visa',
    });
  });

  it('distingue dólares y acepta números', () => {
    expect(parseShortcutPayload({ amount: 'US$ 12.50' })).toMatchObject({ amount: 12.5, currency: 'USD' });
    expect(parseShortcutPayload({ amount: 800 })).toMatchObject({ amount: 800, currency: 'ARS' });
  });

  it('rechaza importes ilegibles', () => {
    expect(parseShortcutPayload({ amount: 'gratis' })).toBeNull();
    expect(parseShortcutPayload({})).toBeNull();
  });
});

describe('matchAccount', () => {
  it('busca por últimos 4 dígitos y después por nombre', () => {
    expect(matchAccount('Visa •••• 1234', ACCOUNTS)).toBe('visa');
    expect(matchAccount('Mi Amex', ACCOUNTS)).toBe('amex');
  });

  it('sin match usa la única cuenta, si hay una sola', () => {
    expect(matchAccount('Otra', ACCOUNTS)).toBeNull();
    expect(matchAccount(null, [ACCOUNTS[0]])).toBe('visa');
  });
});

describe('isSameCharge', () => {
  const base = { amount: 1500, currency: 'ARS', date: '2026-10-20' };
  it('acepta el mismo monto a un día de distancia', () => {
    expect(isSameCharge(base, { amount: '1500.00', currency: 'ARS', date: '2026-10-21' })).toBe(true);
  });
  it('rechaza otra moneda, otro monto o más de un día', () => {
    expect(isSameCharge(base, { ...base, currency: 'USD' })).toBe(false);
    expect(isSameCharge(base, { ...base, amount: 1501 })).toBe(false);
    expect(isSameCharge(base, { ...base, date: '2026-10-22' })).toBe(false);
  });
});

describe('fechas', () => {
  it('usa la fecha de Argentina', () => {
    expect(todayAr(new Date('2026-10-21T02:00:00Z'))).toBe('2026-10-20');
    expect(dayWindow('2026-11-01')).toEqual({ from: '2026-10-31', to: '2026-11-02' });
  });
});

describe('mensajeAtajo', () => {
  const base = { amount: 14667, currency: 'ARS', merchant: 'Express Teodoro Garcia 23', rubro: null, cuenta: null, confirmado: false };

  it('muestra monto y comercio en una línea', () => {
    expect(mensajeAtajo(base)).toMatch(/^✅ \$\s?14\.667 en Express Teodoro Garcia 23$/);
  });

  it('suma rubro, cuenta y si venía del mail en la segunda línea', () => {
    const texto = mensajeAtajo({ ...base, rubro: 'Supermercado', cuenta: 'Visa Galicia', confirmado: true });
    expect(texto.split('\n')[1]).toBe('Supermercado · Visa Galicia · ya había llegado el mail, quedó confirmado');
  });

  it('conserva los centavos y funciona sin comercio', () => {
    expect(mensajeAtajo({ ...base, amount: 1500.5, merchant: null })).toMatch(/^✅ \$\s?1\.500,50$/);
  });
});
