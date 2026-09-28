'use client'

import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, withId, PRECIO_VACIO, TIPOS_RESERVA, type Hotel, type TipoReserva } from '../db'
import { Field, FormActions, Modal, PrecioMeta, conNota, fmtDate, usePrecio } from '../ui'

const EMPTY: Hotel = {
  tipo: 'Hotel',
  ciudad: '',
  nombre: '',
  direccion: '',
  checkIn: '',
  checkOut: '',
  reserva: '',
  confirmado: false,
  notas: '',
  ...PRECIO_VACIO,
}

const ICONO: Record<TipoReserva, string> = {
  Hotel: '🏨',
  Auto: '🚗',
  Atracción: '🎡',
  Restaurante: '🍽️',
  Tour: '🗺️',
  Otro: '📌',
}

export default function Reservas() {
  const items = useLiveQuery(
    () => db.hotels.toArray().then((arr) => arr.sort((a, b) => a.checkIn.localeCompare(b.checkIn))),
    [],
  )
  const [editing, setEditing] = useState<Hotel | null>(null)
  const [filtro, setFiltro] = useState<TipoReserva | ''>('')

  if (!items) return null

  const visibles = filtro ? items.filter((h) => h.tipo === filtro) : items

  return (
    <main className="page">
      <div className="page-title">
        <h2>Reservas</h2>
        <button className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          + Reserva
        </button>
      </div>

      <div className="filters">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as TipoReserva | '')}>
          <option value="">Todos los tipos</option>
          {TIPOS_RESERVA.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {visibles.length === 0 && <div className="empty">Sin reservas que mostrar.</div>}

      {visibles.map((h) => (
        <div className="card" key={h.id}>
          <div className="card-head">
            <div>
              <h3>
                {ICONO[h.tipo ?? 'Otro']} {h.nombre || (h.tipo === 'Hotel' ? 'Por confirmar' : h.tipo)}
              </h3>
              <div className="meta">{h.ciudad}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <span className="badge info">{h.tipo}</span>
              {h.confirmado ? (
                <span className="badge ok">Confirmado</span>
              ) : (
                <span className="badge warn">Por confirmar</span>
              )}
            </div>
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            {h.direccion && (
              <>
                📍 {h.direccion}
                <br />
              </>
            )}
            {(h.checkIn || h.checkOut) && (
              <>
                📅{' '}
                {h.checkIn && h.checkOut
                  ? `${fmtDate(h.checkIn)} → ${fmtDate(h.checkOut)}`
                  : fmtDate(h.checkIn || h.checkOut)}
                <br />
              </>
            )}
            {h.reserva && (
              <>
                🔖 <strong>{h.reserva}</strong>
                <br />
              </>
            )}
            <PrecioMeta p={h} />
            {h.notas && <>📝 {h.notas}</>}
          </div>
          <div className="card-actions">
            <button className="btn-ghost btn-sm" onClick={() => setEditing(h)}>
              Editar
            </button>
          </div>
        </div>
      ))}

      {editing && <ReservaForm item={editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function ReservaForm({ item, onClose }: { item: Hotel; onClose: () => void }) {
  const [f, setF] = useState(item)
  const precio = usePrecio(f)
  const set = (k: keyof Hotel) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const p = precio.resolver()
    if (!p) return
    const { nota, ...valores } = p
    await db.hotels.put(withId({ ...f, ...valores, notas: conNota(f.notas, nota) }))
    onClose()
  }
  async function remove() {
    if (f.id && confirm(`¿Borrar la reserva "${f.nombre || f.tipo}"?`)) {
      await db.hotels.delete(f.id)
      onClose()
    }
  }

  return (
    <Modal title={f.id ? 'Editar reserva' : 'Nueva reserva'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Tipo">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoReserva })}>
            {TIPOS_RESERVA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Nombre / Proveedor">
            <input value={f.nombre} onChange={set('nombre')} placeholder="Les Plumes Hotel, Avis, Coliseo…" />
          </Field>
          <Field label="Ciudad">
            <input value={f.ciudad} onChange={set('ciudad')} />
          </Field>
        </div>
        <Field label="Dirección / Ubicación">
          <input value={f.direccion} onChange={set('direccion')} />
        </Field>
        <div className="form-row">
          <Field label="Fecha desde / Check-in">
            <input type="date" value={f.checkIn} onChange={set('checkIn')} />
          </Field>
          <Field label="Fecha hasta / Check-out">
            <input type="date" value={f.checkOut} onChange={set('checkOut')} />
          </Field>
        </div>
        <Field label="N° de reserva">
          <input value={f.reserva} onChange={set('reserva')} />
        </Field>
        {precio.campos}
        <Field label="Estado">
          <select value={f.confirmado ? 'si' : 'no'} onChange={(e) => setF({ ...f, confirmado: e.target.value === 'si' })}>
            <option value="no">Por confirmar</option>
            <option value="si">Confirmado</option>
          </select>
        </Field>
        <Field label="Notas">
          <textarea rows={2} value={f.notas} onChange={set('notas')} />
        </Field>
        <FormActions onCancel={onClose} onDelete={f.id ? remove : undefined} />
      </form>
    </Modal>
  )
}
