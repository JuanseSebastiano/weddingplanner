import { useState, type ReactNode } from 'react'
import type { Precio } from './db'

export function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtRange(desde: string, hasta: string): string {
  if (desde === hasta) return fmtDate(desde)
  const [y1, m1] = desde.split('-'), [y2, m2] = hasta.split('-')
  const d1 = new Date(+y1, +m1 - 1, +desde.split('-')[2])
  const d2 = new Date(+y2, +m2 - 1, +hasta.split('-')[2])
  if (y1 === y2 && m1 === m2) {
    return `${d1.getDate()}–${d2.getDate()} ${d2.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}`
  }
  return `${fmtDate(desde)} – ${fmtDate(hasta)}`
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function FormActions({ onCancel, onDelete }: { onCancel: () => void; onDelete?: () => void }) {
  return (
    <div className="form-actions">
      {onDelete && (
        <button type="button" className="btn-danger" onClick={onDelete}>
          Borrar
        </button>
      )}
      <button type="button" className="btn-ghost" onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" className="btn-primary">
        Guardar
      </button>
    </div>
  )
}

export function fmtPrecio(p: Pick<Precio, 'amount' | 'currency'>): string {
  if (p.amount === null) return ''
  const simbolo = p.currency === 'USD' ? 'US$' : '$'
  return `${simbolo} ${p.amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Monto en ARS, USD o EUR. Los euros se guardan convertidos a dólares con
 * la cotización que se ingresa (queda en fxRate) y el original se anota.
 */
export function useMonto(inicial: { amount: number | null; currency: 'ARS' | 'USD' }, requerido = false) {
  const [monto, setMonto] = useState(inicial.amount === null ? '' : String(inicial.amount))
  const [moneda, setMoneda] = useState<'ARS' | 'USD' | 'EUR'>(inicial.currency)
  const [cotizacion, setCotizacion] = useState('')

  /** Valores a guardar, más una nota si hubo conversión. `null` si falta la cotización. */
  function resolver(): { amount: number | null; currency: 'ARS' | 'USD'; fxRate: number | null; nota: string } | null {
    const n = monto.trim() === '' ? null : Number(monto.replace(',', '.'))
    if (n === null || !Number.isFinite(n)) return { amount: null, currency: moneda === 'EUR' ? 'USD' : moneda, fxRate: null, nota: '' }
    if (moneda !== 'EUR') return { amount: n, currency: moneda, fxRate: null, nota: '' }
    const fx = Number(cotizacion.replace(',', '.'))
    if (!Number.isFinite(fx) || fx <= 0) return null
    const usd = Math.round(n * fx * 100) / 100
    return { amount: usd, currency: 'USD', fxRate: fx, nota: `Original: EUR ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (1 EUR = ${fx} USD)` }
  }

  const campos = (
    <>
      <div className="form-row">
        <Field label="Monto">
          <input type="number" inputMode="decimal" step="0.01" min="0" required={requerido} value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field label="Moneda">
          <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD' | 'EUR')}>
            <option>USD</option>
            <option>ARS</option>
            <option>EUR</option>
          </select>
        </Field>
      </div>
      {moneda === 'EUR' && (
        <Field label="Cotización (1 EUR = ? USD) · se guarda en dólares">
          <input type="number" inputMode="decimal" step="0.0001" min="0" required value={cotizacion} onChange={(e) => setCotizacion(e.target.value)} placeholder="1.08" />
        </Field>
      )}
    </>
  )

  return { campos, resolver }
}

/** Monto + pagado + vencimiento: lo que Finanzas ve como compromiso del viaje. */
export function usePrecio(p: Precio) {
  const monto = useMonto(p)
  const [paid, setPaid] = useState(p.paid)
  const [dueDate, setDueDate] = useState(p.dueDate)

  function resolver(): (Precio & { nota: string }) | null {
    const m = monto.resolver()
    if (!m) return null
    return { amount: m.amount, currency: m.currency, fxRate: m.fxRate, paid, dueDate, nota: m.nota }
  }

  const campos = (
    <>
      {monto.campos}
      <div className="form-row">
        <Field label="Pago">
          <select value={paid ? 'si' : 'no'} onChange={(e) => setPaid(e.target.value === 'si')}>
            <option value="no">Pendiente</option>
            <option value="si">Pagado</option>
          </select>
        </Field>
        <Field label="Vence">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
    </>
  )

  return { campos, resolver }
}

/** Suma la nota de conversión a las notas existentes. */
export function conNota(notas: string, nota: string): string {
  return nota ? [notas, nota].filter(Boolean).join(' · ') : notas
}

export function PrecioMeta({ p }: { p: Precio }) {
  if (p.amount === null) return null
  return (
    <div>
      💰 <strong>{fmtPrecio(p)}</strong> · {p.paid ? 'pagado' : p.dueDate ? `vence ${fmtDate(p.dueDate)}` : 'pendiente'}
    </div>
  )
}
