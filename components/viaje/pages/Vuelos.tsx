'use client'

import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, withId, PRECIO_VACIO, type Flight } from '../db'
import { Field, FormActions, Modal, PrecioMeta, conNota, fmtDate, usePrecio } from '../ui'

const EMPTY: Flight = {
  origen: '', destino: '', fecha: '', horaSalida: '', horaLlegada: '',
  vuelo: '', aerolinea: '', referencia: '', clase: 'Economy', pasajeros: '', equipaje: '', notas: '', ...PRECIO_VACIO
}

export default function Vuelos() {
  const flights = useLiveQuery(() => db.flights.orderBy('fecha').toArray(), [])
  const [editing, setEditing] = useState<Flight | null>(null)

  if (!flights) return null

  return (
    <main className="page">
      <div className="page-title">
        <h2>Vuelos</h2>
        <button className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          + Vuelo
        </button>
      </div>

      {flights.length === 0 && <div className="empty">Sin vuelos cargados.</div>}

      {flights.map((v) => (
        <div className="card" key={v.id}>
          <div className="card-head">
            <h3>
              {v.origen} → {v.destino}
            </h3>
            {v.vuelo && v.vuelo !== 'Por confirmar' ? (
              <span className="badge ok">{v.vuelo}</span>
            ) : (
              <span className="badge warn">Por confirmar</span>
            )}
          </div>
          <div className="meta">
            📅 <strong>{fmtDate(v.fecha)}</strong>
            {v.horaSalida && (
              <>
                {' '}· sale <strong>{v.horaSalida}</strong>
                {v.horaLlegada && <> – llega <strong>{v.horaLlegada}</strong></>}
              </>
            )}
            <br />
            {v.aerolinea && <>{v.aerolinea} · </>}
            {v.clase}
            {v.referencia && (
              <>
                {' '}· Ref: <strong>{v.referencia}</strong>
              </>
            )}
            <br />
            👤 {v.pasajeros}
            {v.equipaje && <> · 🧳 {v.equipaje}</>}
            <PrecioMeta p={v} />
            {v.notas && <div>📝 {v.notas}</div>}
          </div>
          <div className="card-actions">
            <button className="btn-ghost btn-sm" onClick={() => setEditing(v)}>
              Editar
            </button>
          </div>
        </div>
      ))}

      {editing && <FlightForm flight={editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function FlightForm({ flight, onClose }: { flight: Flight; onClose: () => void }) {
  const [f, setF] = useState(flight)
  const precio = usePrecio(f)
  const set = (k: keyof Flight) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const p = precio.resolver()
    if (!p) return
    const { nota, ...valores } = p
    await db.flights.put(withId({ ...f, ...valores, notas: conNota(f.notas, nota) }))
    onClose()
  }
  async function remove() {
    if (f.id && confirm(`¿Borrar el vuelo ${f.origen} → ${f.destino}?`)) {
      await db.flights.delete(f.id)
      onClose()
    }
  }

  return (
    <Modal title={f.id ? 'Editar vuelo' : 'Nuevo vuelo'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="form-row">
          <Field label="Origen">
            <input required value={f.origen} onChange={set('origen')} />
          </Field>
          <Field label="Destino">
            <input required value={f.destino} onChange={set('destino')} />
          </Field>
        </div>
        <Field label="Fecha">
          <input type="date" required value={f.fecha} onChange={set('fecha')} />
        </Field>
        <div className="form-row">
          <Field label="Hora salida">
            <input type="time" value={f.horaSalida} onChange={set('horaSalida')} />
          </Field>
          <Field label="Hora llegada">
            <input type="time" value={f.horaLlegada} onChange={set('horaLlegada')} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="N° de vuelo">
            <input value={f.vuelo} onChange={set('vuelo')} placeholder="AF0471" />
          </Field>
          <Field label="Aerolínea">
            <input value={f.aerolinea} onChange={set('aerolinea')} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Referencia">
            <input value={f.referencia} onChange={set('referencia')} />
          </Field>
          <Field label="Clase">
            <input value={f.clase} onChange={set('clase')} />
          </Field>
        </div>
        <Field label="Pasajeros">
          <input value={f.pasajeros} onChange={set('pasajeros')} />
        </Field>
        <Field label="Equipaje">
          <input value={f.equipaje} onChange={set('equipaje')} />
        </Field>
        {precio.campos}
        <Field label="Notas">
          <textarea rows={2} value={f.notas} onChange={set('notas')} />
        </Field>
        <FormActions onCancel={onClose} onDelete={f.id ? remove : undefined} />
      </form>
    </Modal>
  )
}
