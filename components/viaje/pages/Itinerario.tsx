'use client'

import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, withId, type Stop } from '../db'
import { Field, FormActions, Modal, fmtRange } from '../ui'

const EMPTY: Stop = { ciudad: '', region: '', pais: '', desde: '', hasta: '', hotel: '', transporteLlegada: '', notas: '' }

export default function Itinerario() {
  const stops = useLiveQuery(() => db.stops.orderBy('desde').toArray(), [])
  const [editing, setEditing] = useState<Stop | null>(null)

  if (!stops) return null

  return (
    <main className="page">
      <div className="page-title">
        <h2>Itinerario</h2>
        <button className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          + Parada
        </button>
      </div>

      {stops.length === 0 && <div className="empty">Sin paradas todavía. Agregá la primera.</div>}

      <div className="timeline">
        {stops.map((s, i) => (
          <div className="tl-item" key={s.id}>
            <div className="tl-rail">
              <div className="tl-dot" />
              {i < stops.length - 1 && <div className="tl-line" />}
            </div>
            <div className="tl-body">
              {s.transporteLlegada && (
                <div className="tl-transport">
                  <span>→</span>
                  <span>{s.transporteLlegada}</span>
                </div>
              )}
              <div className="card">
                <div className="card-head">
                  <div>
                    <h3>{s.ciudad}</h3>
                    <div className="meta">
                      {s.region}
                      {s.pais && s.pais !== '—' ? `, ${s.pais}` : ''}
                    </div>
                  </div>
                  <span className="badge info">{fmtRange(s.desde, s.hasta)}</span>
                </div>
                <div className="meta" style={{ marginTop: 6 }}>
                  🏨 <strong>{s.hotel || 'Sin hotel'}</strong>
                  {s.notas && <div>📝 {s.notas}</div>}
                </div>
                <div className="card-actions">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(s)}>
                    Editar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <StopForm stop={editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function StopForm({ stop, onClose }: { stop: Stop; onClose: () => void }) {
  const [f, setF] = useState(stop)
  const set = (k: keyof Stop) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    await db.stops.put(withId(f))
    onClose()
  }
  async function remove() {
    if (f.id && confirm(`¿Borrar la parada "${f.ciudad}"?`)) {
      await db.stops.delete(f.id)
      onClose()
    }
  }

  return (
    <Modal title={f.id ? 'Editar parada' : 'Nueva parada'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Ciudad / Zona">
          <input required value={f.ciudad} onChange={set('ciudad')} />
        </Field>
        <div className="form-row">
          <Field label="Región">
            <input value={f.region} onChange={set('region')} />
          </Field>
          <Field label="País">
            <input value={f.pais} onChange={set('pais')} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Desde">
            <input type="date" required value={f.desde} onChange={set('desde')} />
          </Field>
          <Field label="Hasta">
            <input type="date" required value={f.hasta} onChange={set('hasta')} />
          </Field>
        </div>
        <Field label="Hotel">
          <input value={f.hotel} onChange={set('hotel')} placeholder="Por confirmar" />
        </Field>
        <Field label="Transporte de llegada">
          <input value={f.transporteLlegada} onChange={set('transporteLlegada')} placeholder="Tren, vuelo, traslado…" />
        </Field>
        <Field label="Notas">
          <textarea rows={2} value={f.notas} onChange={set('notas')} />
        </Field>
        <FormActions onCancel={onClose} onDelete={f.id ? remove : undefined} />
      </form>
    </Modal>
  )
}
