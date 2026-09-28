import Dexie, { type EntityTable, type Transaction } from 'dexie'

/*
 * Cache local del viaje (IndexedDB). Es el esquema de Luna de Miel con dos
 * cambios: los ids son uuid (se crean offline y después suben a Supabase) y
 * lo que tiene precio guarda monto, moneda (ARS/USD), cotización, si está
 * pagado y cuándo vence. Cada cambio local queda en `outbox` hasta que
 * sync.ts lo sube.
 */

export type Moneda = 'ARS' | 'USD'

/** Campos de precio, compartidos por vuelos, trenes, reservas y crucero. */
export interface Precio {
  amount: number | null
  currency: Moneda
  fxRate: number | null
  paid: boolean
  dueDate: string
}

export const PRECIO_VACIO: Precio = { amount: null, currency: 'USD', fxRate: null, paid: false, dueDate: '' }

export interface Trip {
  id?: string
  nombre: string
  inicio: string // ISO date
  fin: string
  viajeros: string[]
}

export interface Stop {
  id?: string
  ciudad: string
  region: string
  pais: string
  desde: string // ISO date
  hasta: string
  hotel: string
  transporteLlegada: string // cómo se llega a esta parada
  notas: string
}

export interface Flight extends Precio {
  id?: string
  origen: string
  destino: string
  fecha: string // ISO date
  horaSalida: string
  horaLlegada: string
  vuelo: string
  aerolinea: string
  referencia: string
  clase: string
  pasajeros: string
  equipaje: string
  notas: string
}

export interface Train extends Precio {
  id?: string
  origen: string
  destino: string
  fecha: string
  hora: string
  estacion: string
  boleto: string
  notas: string
}

export const TIPOS_RESERVA = ['Hotel', 'Auto', 'Atracción', 'Restaurante', 'Tour', 'Otro'] as const
export type TipoReserva = (typeof TIPOS_RESERVA)[number]

export interface Hotel extends Precio {
  id?: string
  tipo: TipoReserva
  ciudad: string
  nombre: string
  direccion: string
  checkIn: string
  checkOut: string
  reserva: string
  confirmado: boolean
  notas: string
}

export interface Cruise extends Precio {
  id?: string
  barco: string
  embarquePuerto: string
  embarqueFecha: string
  noches: number
  escalas: string[]
  cabinaTipo: string
  cabinaNumero: string
  puente: string
  huespedes: string
  tarifaPorPersona: string
  notas: string
}

export const CATEGORIAS = ['Comida', 'Transporte', 'Alojamiento', 'Actividades', 'Compras', 'Otros'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export interface Expense {
  id?: string
  fecha: string
  concepto: string
  categoria: Categoria
  amount: number
  currency: Moneda
  fxRate: number | null
}

export interface OutboxEntry {
  key: string // `${tabla}:${id}`
  table: TableName
  id: string
  op: 'upsert' | 'delete'
  seq: number
}

export interface Meta {
  key: string
  value: string
}

export const db = new Dexie('Viaje') as Dexie & {
  trips: EntityTable<Trip, 'id'>
  stops: EntityTable<Stop, 'id'>
  flights: EntityTable<Flight, 'id'>
  trains: EntityTable<Train, 'id'>
  hotels: EntityTable<Hotel, 'id'>
  cruise: EntityTable<Cruise, 'id'>
  expenses: EntityTable<Expense, 'id'>
  outbox: EntityTable<OutboxEntry, 'key'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  trips: 'id',
  stops: 'id, desde',
  flights: 'id, fecha',
  trains: 'id, fecha',
  hotels: 'id, tipo, ciudad',
  cruise: 'id',
  expenses: 'id, fecha, categoria, currency',
  outbox: 'key, seq',
  meta: 'key',
})

/** Tablas locales y su tabla en Supabase. */
export const TABLES = {
  trips: 'trip_trips',
  stops: 'trip_stops',
  flights: 'trip_flights',
  trains: 'trip_trains',
  hotels: 'trip_bookings',
  cruise: 'trip_cruises',
  expenses: 'trip_expenses',
} as const

export type TableName = keyof typeof TABLES

/** Asigna uuid a un registro nuevo (antes lo hacía el ++id de Dexie). */
export function withId<T extends { id?: string }>(item: T): T & { id: string } {
  return { ...item, id: item.id ?? crypto.randomUUID() }
}

// ---- Outbox ----

/** Marca de las transacciones que aplican cambios bajados del servidor. */
export const REMOTE = Symbol('remote')

let seq = Date.now()
const listeners = new Set<() => void>()

/** sync.ts se suscribe para subir apenas hay algo nuevo. */
export function onLocalChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function enqueue(table: TableName, id: string, op: OutboxEntry['op']) {
  // El hook corre dentro de la transacción de la tabla, que no incluye el
  // outbox: se escribe en una transacción aparte.
  void Dexie.ignoreTransaction(() => db.outbox.put({ key: `${table}:${id}`, table, id, op, seq: ++seq })).then(() => {
    for (const listener of listeners) listener()
  })
}

function isRemote(tx: Transaction | undefined) {
  return Boolean(tx && (tx as unknown as Record<symbol, boolean>)[REMOTE])
}

for (const table of Object.keys(TABLES) as TableName[]) {
  const t = db.table(table)
  t.hook('creating', function (primKey, _obj, tx) {
    if (isRemote(tx)) return
    this.onsuccess = (key) => enqueue(table, String(key ?? primKey), 'upsert')
  })
  t.hook('updating', function (_mods, primKey, _obj, tx) {
    if (isRemote(tx)) return
    this.onsuccess = () => enqueue(table, String(primKey), 'upsert')
  })
  t.hook('deleting', function (primKey, _obj, tx) {
    if (isRemote(tx)) return
    this.onsuccess = () => enqueue(table, String(primKey), 'delete')
  })
}
