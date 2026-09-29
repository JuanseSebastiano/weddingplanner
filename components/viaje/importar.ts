import { PRECIO_VACIO, TIPOS_RESERVA, type Cruise, type Expense, type Flight, type Hotel, type Moneda, type Stop, type Train, type Trip } from './db'

/*
 * Convierte el respaldo JSON de Luna de Miel (botón 💾 → Exportar respaldo,
 * `_app: 'luna-de-miel'`, `_version: 1`) al modelo nuevo. Función pura: la
 * página muestra el resultado (dry-run) antes de escribir nada.
 *
 * - ids numéricos → uuid nuevos.
 * - Precios en texto libre ("USD 1.050,84", "EUR 120", "€90") → monto y
 *   moneda. Los euros se pasan a dólares con la cotización indicada y el
 *   original queda en las notas. Lo que no se puede leer queda en notas.
 */

export interface Importado {
  trips: Trip[]
  stops: Stop[]
  flights: Flight[]
  trains: Train[]
  hotels: Hotel[]
  cruise: Cruise[]
  expenses: Expense[]
  avisos: string[]
  /** Hay montos en EUR y no se indicó cotización: no se puede importar todavía. */
  faltaCotizacion: boolean
}

type Crudo = Record<string, unknown>

/** "1.050,84" → 1050.84 · "1050.84" → 1050.84 · "1,050.84" → 1050.84 · "1.050" → 1050 */
export function parseNumero(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,]/g, '')
  if (!/\d/.test(limpio)) return null
  let normal: string
  if (limpio.includes(',') && limpio.includes('.')) {
    // El último separador es el decimal.
    normal = limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '')
  } else if (limpio.includes(',')) {
    normal = /,\d{1,2}$/.test(limpio) ? limpio.replace(/,/g, (m, i) => (i === limpio.lastIndexOf(',') ? '.' : '')) : limpio.replace(/,/g, '')
  } else {
    normal = /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, '') : limpio
  }
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

/** Moneda y monto de un precio en texto. `null` si no hay número. */
export function parsePrecio(texto: string): { monto: number; moneda: 'ARS' | 'USD' | 'EUR' } | null {
  if (!texto?.trim()) return null
  const monto = parseNumero(texto)
  if (monto === null) return null
  const t = texto.toUpperCase()
  const moneda = /EUR|€/.test(t) ? 'EUR' : /USD|US\$|U\$S|DOLAR|DÓLAR/.test(t) ? 'USD' : /ARS|\$/.test(t) ? 'ARS' : 'EUR'
  return { monto, moneda }
}

export function importarRespaldo(json: string, eurUsd: number | null): Importado {
  const data = JSON.parse(json) as Crudo
  if (data._app !== 'luna-de-miel') throw new Error('El archivo no es un respaldo de Luna de Miel')
  const avisos: string[] = []
  let faltaCotizacion = false
  const lista = (k: string) => (Array.isArray(data[k]) ? (data[k] as Crudo[]) : [])
  const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const id = () => crypto.randomUUID()

  const aUsd = (monto: number, moneda: 'ARS' | 'USD' | 'EUR') => {
    if (moneda !== 'EUR') return { amount: monto, currency: moneda as Moneda, fxRate: null, nota: '' }
    if (!eurUsd) {
      faltaCotizacion = true
      return null
    }
    return {
      amount: Math.round(monto * eurUsd * 100) / 100,
      currency: 'USD' as Moneda,
      fxRate: eurUsd,
      nota: `Original: EUR ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (1 EUR = ${eurUsd} USD)`,
    }
  }

  const precioDeTexto = (texto: string, notas: string, donde: string) => {
    const p = parsePrecio(texto)
    if (!p) {
      if (texto.trim()) avisos.push(`${donde}: no se pudo leer el precio "${texto}"; queda en notas`)
      return { ...PRECIO_VACIO, notas: [notas, texto.trim() && `Precio: ${texto}`].filter(Boolean).join(' · ') }
    }
    const conv = aUsd(p.monto, p.moneda)
    if (!conv) return { ...PRECIO_VACIO, notas: [notas, `Precio: ${texto}`].filter(Boolean).join(' · ') }
    return {
      ...PRECIO_VACIO,
      amount: conv.amount,
      currency: conv.currency,
      fxRate: conv.fxRate,
      notas: [notas, conv.nota].filter(Boolean).join(' · '),
    }
  }

  const trips: Trip[] = lista('trips').map((t) => ({
    id: id(),
    nombre: s(t.nombre),
    inicio: s(t.inicio),
    fin: s(t.fin),
    viajeros: Array.isArray(t.viajeros) ? t.viajeros.map(s) : [],
  }))

  const stops: Stop[] = lista('stops').map((x) => ({
    id: id(),
    ciudad: s(x.ciudad),
    region: s(x.region),
    pais: s(x.pais),
    desde: s(x.desde),
    hasta: s(x.hasta),
    hotel: s(x.hotel),
    transporteLlegada: s(x.transporteLlegada),
    notas: s(x.notas),
  }))

  const flights: Flight[] = lista('flights').map((x) => ({
    ...PRECIO_VACIO,
    id: id(),
    origen: s(x.origen),
    destino: s(x.destino),
    fecha: s(x.fecha),
    horaSalida: s(x.horaSalida),
    horaLlegada: s(x.horaLlegada),
    vuelo: s(x.vuelo),
    aerolinea: s(x.aerolinea),
    referencia: s(x.referencia),
    clase: s(x.clase),
    pasajeros: s(x.pasajeros),
    equipaje: s(x.equipaje),
    notas: s(x.notas),
  }))

  const trains: Train[] = lista('trains').map((x) => ({
    ...PRECIO_VACIO,
    id: id(),
    origen: s(x.origen),
    destino: s(x.destino),
    fecha: s(x.fecha),
    hora: s(x.hora),
    estacion: s(x.estacion),
    boleto: s(x.boleto),
    notas: s(x.notas),
  }))

  const hotels: Hotel[] = lista('hotels').map((x) => {
    const tipo = (TIPOS_RESERVA as readonly string[]).includes(s(x.tipo)) ? (s(x.tipo) as Hotel['tipo']) : 'Hotel'
    const nombre = s(x.nombre)
    return {
      ...precioDeTexto(s(x.precio), s(x.notas), `Reserva ${nombre || tipo}`),
      id: id(),
      tipo,
      ciudad: s(x.ciudad),
      nombre,
      direccion: s(x.direccion),
      checkIn: s(x.checkIn),
      checkOut: s(x.checkOut),
      reserva: s(x.reserva),
      confirmado: Boolean(x.confirmado),
    }
  })

  const cruise: Cruise[] = lista('cruise').map((x) => ({
    ...precioDeTexto(s(x.subtotal), s(x.notas), `Crucero ${s(x.barco)}`),
    id: id(),
    barco: s(x.barco),
    embarquePuerto: s(x.embarquePuerto),
    embarqueFecha: s(x.embarqueFecha),
    noches: Number(x.noches) || 0,
    escalas: Array.isArray(x.escalas) ? x.escalas.map(s) : [],
    cabinaTipo: s(x.cabinaTipo),
    cabinaNumero: s(x.cabinaNumero),
    puente: s(x.puente),
    huespedes: s(x.huespedes),
    tarifaPorPersona: s(x.tarifaPorPersona),
  }))

  const expenses: Expense[] = []
  for (const x of lista('expenses')) {
    const monto = Number(x.monto) || 0
    const moneda = (['ARS', 'USD', 'EUR'].includes(s(x.moneda)) ? s(x.moneda) : 'EUR') as 'ARS' | 'USD' | 'EUR'
    const conv = aUsd(monto, moneda)
    if (!conv) continue
    expenses.push({
      id: id(),
      fecha: s(x.fecha),
      concepto: conv.nota ? `${s(x.concepto)} (${conv.nota})` : s(x.concepto),
      categoria: s(x.categoria) as Expense['categoria'],
      amount: conv.amount,
      currency: conv.currency,
      fxRate: conv.fxRate,
    })
  }

  return { trips, stops, flights, trains, hotels, cruise, expenses, avisos, faltaCotizacion }
}
