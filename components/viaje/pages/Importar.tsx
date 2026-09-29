'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Link from 'next/link'
import { db } from '../db'
import { importarRespaldo, type Importado } from '../importar'
import { Field } from '../ui'

const TABLAS: Array<[keyof Omit<Importado, 'avisos' | 'faltaCotizacion'>, string]> = [
  ['trips', 'Viaje'],
  ['stops', 'Paradas'],
  ['flights', 'Vuelos'],
  ['trains', 'Trenes'],
  ['hotels', 'Reservas'],
  ['cruise', 'Crucero'],
  ['expenses', 'Gastos'],
]

/**
 * Importa el respaldo JSON de la app vieja (Luna de Miel → 💾 → Exportar
 * respaldo). Primero muestra qué va a entrar (dry-run) y recién con
 * "Importar" escribe; después la sincronización lo sube a Supabase.
 */
export default function Importar() {
  const existentes = useLiveQuery(
    () => Promise.all(TABLAS.map(([t]) => db.table(t).count())).then((c) => c.reduce((a, b) => a + b, 0)),
    [],
  )
  const [json, setJson] = useState<string | null>(null)
  const [cotizacion, setCotizacion] = useState('')
  const [hecho, setHecho] = useState(false)

  let vista: Importado | null = null
  let error = ''
  if (json) {
    try {
      const fx = Number(cotizacion.replace(',', '.'))
      vista = importarRespaldo(json, fx > 0 ? fx : null)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Archivo inválido'
    }
  }

  async function importar() {
    if (!vista) return
    await db.transaction('rw', TABLAS.map(([t]) => db.table(t)), async () => {
      for (const [t] of TABLAS) await db.table(t).bulkPut(vista![t])
    })
    setHecho(true)
  }

  return (
    <main className="page">
      <div className="page-title">
        <h2>Importar respaldo</h2>
      </div>

      <div className="card meta">
        En la app vieja de Luna de Miel: botón 💾 → <strong>Exportar respaldo</strong>. Elegí acá ese
        archivo: primero vas a ver qué entra y recién después se importa.
      </div>

      {hecho ? (
        <div className="card">
          <h3>Listo</h3>
          <div className="meta">Los datos quedaron en este dispositivo y se suben solos a la nube.</div>
          <div className="card-actions">
            <Link className="btn btn-primary btn-sm" href="/viaje">
              Ver itinerario
            </Link>
          </div>
        </div>
      ) : existentes ? (
        <div className="card meta">
          El viaje ya tiene {existentes} registros. Para no duplicar ni pisar nada, el respaldo solo se
          importa en un viaje vacío.
        </div>
      ) : (
        <div className="card form">
          <Field label="Archivo de respaldo (.json)">
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                setJson(file ? await file.text() : null)
              }}
            />
          </Field>
          <Field label="Cotización para los euros (1 EUR = ? USD)">
            <input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              value={cotizacion}
              onChange={(e) => setCotizacion(e.target.value)}
              placeholder="1.08"
            />
          </Field>

          {error && <div className="meta">❌ {error}</div>}

          {vista && (
            <>
              <div className="meta">
                <strong>Vista previa (todavía no se importó nada)</strong>
              </div>
              {TABLAS.map(([t, label]) => (
                <div className="total-row" key={t}>
                  <span>{label}</span>
                  <span className="amount">{vista![t].length}</span>
                </div>
              ))}
              {vista.faltaCotizacion && (
                <div className="meta">⚠️ Hay montos en euros: cargá la cotización para convertirlos a dólares.</div>
              )}
              {vista.avisos.map((a) => (
                <div className="meta" key={a}>
                  ⚠️ {a}
                </div>
              ))}
              <button className="btn-primary" disabled={vista.faltaCotizacion} onClick={() => void importar()}>
                Importar
              </button>
            </>
          )}
        </div>
      )}
    </main>
  )
}
