'use client'

import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, withId, PRECIO_VACIO, type Cruise } from '../db'
import { Field, FormActions, Modal, PrecioMeta, conNota, fmtDate, usePrecio } from '../ui'

const EMPTY: Cruise = {
  barco: '', embarquePuerto: '', embarqueFecha: '', noches: 7, escalas: [],
  cabinaTipo: '', cabinaNumero: '', puente: '', huespedes: '', tarifaPorPersona: '', notas: '', ...PRECIO_VACIO,
}

export default function Crucero() {
  const cruises = useLiveQuery(() => db.cruise.toArray(), [])
  const [editing, setEditing] = useState<Cruise | null>(null)

  if (!cruises) return null

  return (
    <main className="page">
      <div className="page-title">
        <h2>Crucero</h2>
        {cruises.length === 0 && (
          <button className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
            + Crucero
          </button>
        )}
      </div>

      {cruises.length === 0 && <div className="empty">Sin crucero cargado.</div>}

      {cruises.map((c) => (
        <div className="card" key={c.id}>
          <div className="card-head">
            <h3>🚢 {c.barco}</h3>
            <span className="badge info">{c.noches} noches</span>
          </div>
          <div className="meta">
            ⚓ Embarque: <strong>{c.embarquePuerto}</strong>, {fmtDate(c.embarqueFecha)}
            {c.notas && <> · {c.notas}</>}
          </div>
          <hr className="sep" />
          <div className="meta"><strong>Escalas</strong></div>
          <div className="escalas">
            {c.escalas.map((e, i) => (
              <div className="escala" key={i}>
                <span className="n">{i + 1}</span> {e}
              </div>
            ))}
          </div>
          <hr className="sep" />
          <div className="meta">
            🛏️ Cabina <strong>{c.cabinaTipo}</strong> · N° <strong>{c.cabinaNumero}</strong> · Puente <strong>{c.puente}</strong>
            <br />
            👥 {c.huespedes}
            <br />
            {c.tarifaPorPersona && <>Tarifa: <strong>{c.tarifaPorPersona}</strong> por persona</>}
            <PrecioMeta p={c} />
          </div>
          <div className="card-actions">
            <button className="btn-ghost btn-sm" onClick={() => setEditing(c)}>
              Editar
            </button>
          </div>
        </div>
      ))}

      {editing && <CruiseForm cruise={editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function CruiseForm({ cruise, onClose }: { cruise: Cruise; onClose: () => void }) {
  const [f, setF] = useState(cruise)
  const [escalas, setEscalas] = useState(cruise.escalas.join('\n'))
  const precio = usePrecio(f)
  const set = (k: keyof Cruise) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const p = precio.resolver()
    if (!p) return
    const { nota, ...valores } = p
    await db.cruise.put(
      withId({
        ...f,
        ...valores,
        notas: conNota(f.notas, nota),
        noches: Number(f.noches) || 0,
        escalas: escalas.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    )
    onClose()
  }
  async function remove() {
    if (f.id && confirm(`¿Borrar el crucero ${f.barco}?`)) {
      await db.cruise.delete(f.id)
      onClose()
    }
  }

  return (
    <Modal title={f.id ? 'Editar crucero' : 'Nuevo crucero'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Barco">
          <input required value={f.barco} onChange={set('barco')} />
        </Field>
        <div className="form-row">
          <Field label="Puerto de embarque">
            <input value={f.embarquePuerto} onChange={set('embarquePuerto')} />
          </Field>
          <Field label="Fecha de embarque">
            <input type="date" value={f.embarqueFecha} onChange={set('embarqueFecha')} />
          </Field>
        </div>
        <Field label="Noches">
          <input type="number" min={1} value={f.noches} onChange={(e) => setF({ ...f, noches: Number(e.target.value) })} />
        </Field>
        <Field label="Escalas (una por línea)">
          <textarea rows={6} value={escalas} onChange={(e) => setEscalas(e.target.value)} />
        </Field>
        <div className="form-row">
          <Field label="Tipo de cabina">
            <input value={f.cabinaTipo} onChange={set('cabinaTipo')} />
          </Field>
          <Field label="N° de cabina">
            <input value={f.cabinaNumero} onChange={set('cabinaNumero')} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Puente">
            <input value={f.puente} onChange={set('puente')} />
          </Field>
          <Field label="Huéspedes">
            <input value={f.huespedes} onChange={set('huespedes')} />
          </Field>
        </div>
        <Field label="Tarifa por persona">
          <input value={f.tarifaPorPersona} onChange={set('tarifaPorPersona')} />
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
