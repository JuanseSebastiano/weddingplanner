'use client'

import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, withId, type ItemTipo, type Moneda, type Payment, type Precio } from './db'
import { Field, Modal, fmtDate, fmtPrecio, useMonto } from './ui'

/** Ítem con precio del viaje, con lo pagado según sus cuotas (o su `paid`). */
export interface ItemPresupuesto {
  tipo: ItemTipo
  id: string
  label: string
  amount: number
  currency: Moneda
  cuotas: Payment[]
  pagado: number
  proxima: Payment | null
}

function pagadoDe(p: Precio, cuotas: Payment[]): number {
  if (cuotas.length === 0) return p.paid ? p.amount ?? 0 : 0
  return cuotas.filter((c) => c.paid).reduce((acc, c) => acc + c.amount, 0)
}

/** Lo mismo que la vista trip_items de Supabase, pero sobre IndexedDB. */
export function useItemsPresupuesto(): ItemPresupuesto[] | undefined {
  return useLiveQuery(async () => {
    const [flights, trains, hotels, cruise, payments] = await Promise.all([
      db.flights.toArray(),
      db.trains.toArray(),
      db.hotels.toArray(),
      db.cruise.toArray(),
      db.payments.orderBy('fecha').toArray(),
    ])
    const porItem = new Map<string, Payment[]>()
    for (const p of payments) porItem.set(p.itemId, [...(porItem.get(p.itemId) ?? []), p])

    const items: Array<{ tipo: ItemTipo; p: Precio & { id?: string }; label: string }> = [
      ...cruise.map((c) => ({ tipo: 'cruise' as const, p: c, label: `Crucero ${c.barco}` })),
      ...flights.map((f) => ({ tipo: 'flight' as const, p: f, label: `Vuelo ${f.origen} → ${f.destino}` })),
      ...trains.map((t) => ({ tipo: 'train' as const, p: t, label: `Tren ${t.origen} → ${t.destino}` })),
      ...hotels.map((h) => ({
        tipo: 'booking' as const,
        p: h,
        label: [h.tipo + (h.nombre ? ` ${h.nombre}` : ''), h.ciudad].filter(Boolean).join(' · '),
      })),
    ]
    return items
      .filter(({ p }) => p.id && p.amount !== null)
      .map(({ tipo, p, label }) => {
        const cuotas = porItem.get(p.id!) ?? []
        return {
          tipo,
          id: p.id!,
          label,
          amount: p.amount!,
          currency: p.currency,
          cuotas,
          pagado: pagadoDe(p, cuotas),
          proxima: cuotas.find((c) => !c.paid) ?? null,
        }
      })
  }, [])
}

/** Estado del pago de un ítem: con cuotas muestra cuánto se pagó del total. */
export function EstadoPago({ p }: { p: Precio & { id?: string } }) {
  const cuotas = useLiveQuery(
    () => (p.id ? db.payments.where('itemId').equals(p.id).sortBy('fecha') : []),
    [p.id],
  )
  if (!cuotas || cuotas.length === 0) {
    return <>{p.paid ? 'pagado' : p.dueDate ? `vence ${fmtDate(p.dueDate)}` : 'pendiente'}</>
  }
  const pagado = pagadoDe(p, cuotas)
  const proxima = cuotas.find((c) => !c.paid)
  return (
    <>
      {fmtPrecio({ amount: pagado, currency: p.currency })} pagado en cuotas
      {proxima ? ` · próxima ${fmtDate(proxima.fecha)}` : ''}
    </>
  )
}

/** Cuotas de un ítem: alta, marcar pagada y borrar. */
export function CuotasModal({ item, onClose }: { item: ItemPresupuesto; onClose: () => void }) {
  const [altas, setAltas] = useState(0)
  const asignado = item.cuotas.reduce((acc, c) => acc + c.amount, 0)

  return (
    <Modal title={`Cuotas · ${item.label}`} onClose={onClose}>
      <div className="meta">
        Total {fmtPrecio(item)} · pagado {fmtPrecio({ amount: item.pagado, currency: item.currency })} · falta{' '}
        {fmtPrecio({ amount: item.amount - item.pagado, currency: item.currency })}
      </div>
      {item.cuotas.length > 0 && Math.abs(asignado - item.amount) > 0.005 && (
        <div className="meta">
          Las cuotas suman {fmtPrecio({ amount: asignado, currency: item.currency })} y el total es{' '}
          {fmtPrecio(item)}.
        </div>
      )}

      <div className="card">
        {item.cuotas.length === 0 && <div className="empty">Sin cuotas: se paga en un solo pago.</div>}
        {item.cuotas.map((c) => (
          <div className="expense-row" key={c.id}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={c.paid}
                onChange={(e) => db.payments.update(c.id!, { paid: e.target.checked })}
              />
              <span>
                <div>{fmtDate(c.fecha)}</div>
                <div className="meta">{c.paid ? 'pagada' : 'pendiente'}</div>
              </span>
            </label>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="amount">{fmtPrecio(c)}</span>
              <button
                type="button"
                className="btn-ghost btn-sm"
                aria-label="Borrar cuota"
                onClick={() => confirm('¿Borrar esta cuota?') && db.payments.delete(c.id!)}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>

      <NuevaCuota key={altas} item={item} onAgregada={() => setAltas((n) => n + 1)} onClose={onClose} />
    </Modal>
  )
}

function NuevaCuota({
  item,
  onAgregada,
  onClose,
}: {
  item: ItemPresupuesto
  onAgregada: () => void
  onClose: () => void
}) {
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState('')
  const monto = useMonto({ amount: null, currency: item.currency }, true)

  async function agregar(e: FormEvent) {
    e.preventDefault()
    setError('')
    const m = monto.resolver()
    if (!m || m.amount === null || m.amount <= 0) return
    if (m.currency !== item.currency) {
      setError(`La cuota tiene que estar en ${item.currency}, como el total.`)
      return
    }
    await db.payments.put(
      withId<Payment>({
        itemTipo: item.tipo,
        itemId: item.id,
        fecha,
        amount: m.amount,
        currency: m.currency,
        fxRate: m.fxRate,
        paid: false,
        notas: m.nota,
      }),
    )
    onAgregada()
  }

  return (
    <form className="form" onSubmit={agregar}>
      <Field label="Fecha de la cuota">
        <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      {monto.campos}
      {error && <div className="meta">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <button type="submit" className="btn-primary">
          Agregar cuota
        </button>
      </div>
    </form>
  )
}
