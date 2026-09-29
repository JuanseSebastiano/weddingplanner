import { createClient } from '@/lib/supabase/client'
import { db, onLocalChange, REMOTE, TABLES, type TableName } from './db'

/*
 * Sincronización del viaje entre IndexedDB y Supabase.
 *
 * 1. Push: cada entrada del outbox se sube (upsert, o borrado lógico con
 *    deleted_at). Se saca del outbox solo si no cambió mientras subía.
 * 2. Pull: por tabla, lo que cambió en el servidor desde el último
 *    updated_at visto. Las filas con cambios locales sin subir no se pisan.
 *
 * Sin red, las dos fases fallan sin romper nada: la app sigue leyendo de
 * IndexedDB y el outbox espera al próximo intento.
 */

const DATE_KEYS = new Set(['fecha', 'desde', 'hasta', 'inicio', 'fin', 'checkIn', 'checkOut', 'embarqueFecha', 'dueDate'])
const NUMBER_KEYS = new Set(['amount', 'fxRate', 'noches'])
const SERVER_ONLY = new Set(['couple_id', 'created_at', 'updated_at', 'deleted_at'])

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

function toRow(item: Record<string, unknown>) {
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(item)) {
    row[toSnake(key)] = DATE_KEYS.has(key) && value === '' ? null : value
  }
  return row
}

function fromRow(row: Record<string, unknown>) {
  const item: Record<string, unknown> = {}
  for (const [column, value] of Object.entries(row)) {
    if (SERVER_ONLY.has(column)) continue
    const key = toCamel(column)
    if (NUMBER_KEYS.has(key)) item[key] = value === null ? null : Number(value)
    else item[key] = value === null ? '' : value
  }
  return item
}

export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; pending: number }

let state: SyncState = { status: 'idle', pending: 0 }
const subscribers = new Set<(s: SyncState) => void>()

function setState(next: Partial<SyncState>) {
  state = { ...state, ...next }
  for (const fn of subscribers) fn(state)
}

export function subscribeSync(fn: (s: SyncState) => void): () => void {
  subscribers.add(fn)
  fn(state)
  return () => subscribers.delete(fn)
}

async function push() {
  const supabase = createClient()
  const entries = await db.outbox.orderBy('seq').toArray()

  for (const entry of entries) {
    const table = TABLES[entry.table]
    const local = entry.op === 'upsert' ? await db.table(entry.table).get(entry.id) : undefined

    const { error } = local
      ? await supabase.from(table).upsert(toRow(local))
      : await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', entry.id)
    if (error) throw error

    await db.transaction('rw', db.outbox, async () => {
      const current = await db.outbox.get(entry.key)
      if (current?.seq === entry.seq) await db.outbox.delete(entry.key)
    })
  }
}

async function pull() {
  const supabase = createClient()
  const pendingKeys = new Set((await db.outbox.toArray()).map((e) => e.key))

  for (const name of Object.keys(TABLES) as TableName[]) {
    const cursorKey = `cursor:${name}`
    const since = (await db.meta.get(cursorKey))?.value ?? '1970-01-01T00:00:00Z'

    const { data, error } = await supabase
      .from(TABLES[name])
      .select('*')
      .gt('updated_at', since)
      .order('updated_at')
    if (error) throw error
    if (!data?.length) continue

    await db.transaction('rw', db.table(name), db.meta, async (tx) => {
      ;(tx as unknown as Record<symbol, boolean>)[REMOTE] = true
      for (const row of data) {
        if (pendingKeys.has(`${name}:${row.id}`)) continue
        if (row.deleted_at) await db.table(name).delete(row.id)
        else await db.table(name).put(fromRow(row))
      }
      await db.meta.put({ key: cursorKey, value: data[data.length - 1]!.updated_at })
    })
  }
}

/**
 * La cache es del dispositivo: si entra otra persona (otra pareja), se
 * vacía antes de sincronizar para no mezclar ni mostrar datos ajenos.
 */
async function ensureOwner() {
  const { data } = await createClient().auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return
  const owner = (await db.meta.get('owner'))?.value
  if (owner === userId) return
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
    await db.meta.put({ key: 'owner', value: userId })
  })
}

let running: Promise<void> | null = null
let again = false

/** Corre push + pull. Si ya hay uno en curso, encola una sola vuelta más. */
export function sync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setState({ status: 'offline', pending: await db.outbox.count() })
        return
      }
      setState({ status: 'syncing' })
      try {
        await push()
        await pull()
        setState({ status: 'idle', pending: await db.outbox.count() })
      } catch {
        setState({ status: navigator.onLine ? 'error' : 'offline', pending: await db.outbox.count() })
        return
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

/** Arranca la sincronización: ahora, al volver la red y tras cada cambio local. */
export function startSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void sync(), 400)
  }
  const offLocal = onLocalChange(() => {
    void db.outbox.count().then((pending) => setState({ pending }))
    soon()
  })
  window.addEventListener('online', soon)
  window.addEventListener('offline', soon)
  void ensureOwner().then(() => sync())
  return () => {
    clearTimeout(timer)
    offLocal()
    window.removeEventListener('online', soon)
    window.removeEventListener('offline', soon)
  }
}
