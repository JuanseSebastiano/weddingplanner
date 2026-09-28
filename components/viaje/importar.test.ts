import { describe, expect, it } from 'vitest'
import { importarRespaldo, parseNumero, parsePrecio } from './importar'

describe('parseNumero', () => {
  it.each([
    ['1.050,84', 1050.84],
    ['1050.84', 1050.84],
    ['1,050.84', 1050.84],
    ['1.050', 1050],
    ['2.101,68', 2101.68],
    ['90', 90],
    ['12,5', 12.5],
    ['sin número', null],
  ])('%s → %s', (texto, esperado) => expect(parseNumero(texto)).toBe(esperado))
})

describe('parsePrecio', () => {
  it('detecta moneda', () => {
    expect(parsePrecio('USD 1.050,84')).toEqual({ monto: 1050.84, moneda: 'USD' })
    expect(parsePrecio('€ 120')).toEqual({ monto: 120, moneda: 'EUR' })
    expect(parsePrecio('$ 30.000')).toEqual({ monto: 30000, moneda: 'ARS' })
    expect(parsePrecio('')).toBeNull()
  })
})

const RESPALDO = JSON.stringify({
  _app: 'luna-de-miel',
  _version: 1,
  trips: [{ id: 1, nombre: 'Luna de Miel — Europa 2027', inicio: '2027-04-04', fin: '2027-04-30', viajeros: ['A', 'B'] }],
  stops: [{ id: 1, ciudad: 'París', region: '', pais: 'Francia', desde: '2027-04-04', hasta: '2027-04-06', hotel: 'Les Plumes', transporteLlegada: '', notas: '' }],
  flights: [{ id: 1, origen: 'EZE', destino: 'CDG', fecha: '2027-04-04', horaSalida: '00:20', horaLlegada: '18:15', vuelo: 'AF0471', aerolinea: 'Air France', referencia: 'Y552FC', clase: 'Economy', pasajeros: 'J', equipaje: '', notas: '' }],
  trains: [],
  hotels: [
    { id: 1, tipo: 'Hotel', ciudad: 'París', nombre: 'Les Plumes', direccion: '', checkIn: '2027-04-04', checkOut: '2027-04-06', reserva: 'X1', precio: 'EUR 400', confirmado: true, notas: '' },
    { id: 2, tipo: 'Tour', ciudad: 'Roma', nombre: 'Coliseo', direccion: '', checkIn: '', checkOut: '', reserva: '', precio: 'a confirmar', confirmado: false, notas: '' },
  ],
  cruise: [{ id: 1, barco: 'MSC SEAVIEW', embarquePuerto: 'Barcelona', embarqueFecha: '2027-04-18', noches: 7, escalas: ['Barcelona'], cabinaTipo: '', cabinaNumero: '', puente: '', huespedes: '', tarifaPorPersona: 'USD 1.050,84', subtotal: 'USD 2.101,68', notas: '' }],
  expenses: [{ id: 1, fecha: '2027-04-05', concepto: 'Cena', categoria: 'Comida', monto: 50, moneda: 'EUR' }],
})

describe('importarRespaldo', () => {
  it('rechaza archivos que no son de Luna de Miel', () => {
    expect(() => importarRespaldo('{"_app":"otra"}', 1.1)).toThrow()
  })

  it('pide cotización si hay euros y no pierde nada', () => {
    const r = importarRespaldo(RESPALDO, null)
    expect(r.faltaCotizacion).toBe(true)
  })

  it('convierte y cuenta todo con cotización', () => {
    const r = importarRespaldo(RESPALDO, 1.1)
    expect(r.faltaCotizacion).toBe(false)
    expect([r.trips, r.stops, r.flights, r.trains, r.hotels, r.cruise, r.expenses].map((t) => t.length)).toEqual([1, 1, 1, 0, 2, 1, 1])
    expect(r.hotels[0]).toMatchObject({ amount: 440, currency: 'USD', fxRate: 1.1, confirmado: true })
    expect(r.hotels[0]!.notas).toContain('EUR 400')
    expect(r.hotels[1]).toMatchObject({ amount: null })
    expect(r.hotels[1]!.notas).toContain('a confirmar')
    expect(r.avisos).toHaveLength(1)
    expect(r.cruise[0]).toMatchObject({ amount: 2101.68, currency: 'USD' })
    expect(r.expenses[0]).toMatchObject({ amount: 55, currency: 'USD' })
    expect(r.stops[0]!.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
