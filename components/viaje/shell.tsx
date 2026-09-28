'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { startSync, subscribeSync, type SyncState } from './sync'
import { fmtRange } from './ui'
import './viaje.css'

const SECCIONES = ['/viaje', '/viaje/vuelos', '/viaje/trenes', '/viaje/reservas', '/viaje/crucero', '/viaje/gastos']

/**
 * Deja en la cache del service worker todas las secciones del viaje con sus
 * scripts y estilos, para poder abrirlas sin red aunque no se hayan visitado.
 * Mismo nombre de cache que public/sw.js.
 */
async function precalentarOffline() {
  if (!('caches' in window) || !navigator.onLine) return
  const cache = await caches.open('nosotros-v1')
  for (const url of SECCIONES) {
    const response = await fetch(url)
    if (!response.ok || response.redirected) return
    const html = await response.clone().text()
    await cache.put(url, response)
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])]
    await Promise.all(
      assets.map(async (asset) => {
        if (!(await cache.match(asset))) await cache.add(asset).catch(() => {})
      }),
    )
  }
}

/** Cabecera del viaje con el estado de sincronización, y arranque del sync. */
export function ViajeShell({ children }: { children: ReactNode }) {
  const [sync, setSync] = useState<SyncState>({ status: 'idle', pending: 0 })
  const trip = useLiveQuery(() => db.trips.toCollection().first(), [])

  useEffect(() => {
    const stop = startSync()
    const unsubscribe = subscribeSync(setSync)
    const timer = setTimeout(() => void precalentarOffline().catch(() => {}), 2000)
    return () => {
      clearTimeout(timer)
      stop()
      unsubscribe()
    }
  }, [])

  const estado =
    sync.status === 'offline'
      ? `Sin conexión${sync.pending ? ` · ${sync.pending} cambios sin subir` : ''}`
      : sync.status === 'syncing'
        ? 'Sincronizando…'
        : sync.status === 'error'
          ? `No se pudo sincronizar${sync.pending ? ` · ${sync.pending} pendientes` : ''}`
          : sync.pending
            ? `${sync.pending} cambios sin subir`
            : 'Sincronizado'

  return (
    <div className="viaje">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-normal lg:text-[28px]">
            {trip?.nombre ?? 'Viaje'}
          </h1>
          {trip?.inicio && trip.fin && (
            <div className="text-sm text-muted-foreground">{fmtRange(trip.inicio, trip.fin)}</div>
          )}
        </div>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
          <span className={sync.status === 'offline' || sync.status === 'error' ? 'text-warning' : 'text-subtle'}>
            {estado}
          </span>
          <Link href="/viaje/importar" className="text-subtle underline">
            Importar respaldo
          </Link>
        </span>
      </div>
      {children}
    </div>
  )
}
