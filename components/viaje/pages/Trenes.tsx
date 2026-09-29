'use client'

import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, withId, PRECIO_VACIO, type Train } from '../db'
import { Field, FormActions, Modal, PrecioMeta, conNota, fmtDate, usePrecio } from '../ui'

const EMPTY: Train = { origen: '', destino: '', fecha: '', hora: '', estacion: '', boleto: '', notas: '', ...PRECIO_VACIO }

export default function Trenes() {
  const trains = useLiveQuery(() => db.trains.orderBy('fecha').toArray(), [])
  const [editing, setEditing] = useState<Train | null>(null)

  if (!trains) return null

  return (
    <main className="page">
      <div className="page-title">
        <h2>Trenes</h2>
        <button className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          + Tren
        </button>
      </div>

      {trains.length === 0 && <div className="empty">Sin trenes cargados.</div>}

      {trains.map((t) => (
        <div className="card" key={t.id}>
          <div className="card-head">
            <h3>
              {t.origen} → {t.destino}
            </h3>
            {t.boleto ? <span className="badge ok">Boleto {t.boleto}</span> : <span className="badge warn">Sin boleto</span>}
          </div>
          <div className="meta">
            📅 <strong>{fmtDate(t.fecha)}</strong>
            {t.hora && <> · {t.hora} h</>}
            {t.estacion && (
              <>
                <br />🚉 Sale de <strong>{t.estacion}</strong>
              </>
            )}
            <PrecioMeta p={t} />
            {t.notas && <div>📝 {t.notas}</div>}
          </div>
          <div className="card-actions">
            <button className="btn-ghost btn-sm" onClick={() => setEditing(t)}>
              Editar
            </button>
          </div>
        </div>
      ))}

      {editing && <TrainForm train={editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function TrainForm({ train, onClose }: { train: Train; onClose: () => void }) {
  const [f, setF] = useState(train)
  const precio = usePrecio(f)
  const set = (k: keyof Train) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const p = precio.resolver()
    if (!p) return
    const { nota, ...valores } = p
    await db.trains.put(withId({ ...f, ...valores, notas: conNota(f.notas, nota) }))
    onClose()
  }
  async function remove() {
    if (f.id && confirm(`¿Borrar el tren ${f.origen} → ${f.destino}?`)) {
      await db.trains.delete(f.id)
      onClose()
    }
  }

  return (
    <Modal title={f.id ? 'Editar tren' : 'Nuevo tren'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="form-row">
          <Field label="Origen">
            <input required value={f.origen} onChange={set('origen')} />
          </Field>
          <Field label="Destino">
            <input required value={f.destino} onChange={set('destino')} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Fecha">
            <input type="date" required value={f.fecha} onChange={set('fecha')} />
          </Field>
          <Field label="Hora">
            <input type="time" value={f.hora} onChange={set('hora')} />
          </Field>
        </div>
        <Field label="Estación de salida">
          <input value={f.estacion} onChange={set('estacion')} />
        </Field>
        <Field label="N° de boleto">
          <input value={f.boleto} onChange={set('boleto')} />
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
