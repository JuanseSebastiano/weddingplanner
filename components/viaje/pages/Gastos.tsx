'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIAS, db, withId, type Categoria, type Expense, type Moneda } from '../db'
import { Field, FormActions, Modal, fmtDate, useMonto } from '../ui'

const MONEDAS: Moneda[] = ['USD', 'ARS']
const SIMBOLO: Record<Moneda, string> = { USD: 'US$', ARS: '$' }

function fmtMonto(monto: number, moneda: Moneda): string {
  return `${SIMBOLO[moneda]} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Gastos() {
  const expenses = useLiveQuery(() => db.expenses.orderBy('fecha').reverse().toArray(), [])
  const [editing, setEditing] = useState<Expense | null>(null)
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroMon, setFiltroMon] = useState('')

  const filtered = useMemo(
    () =>
      (expenses ?? []).filter(
        (e) => (!filtroCat || e.categoria === filtroCat) && (!filtroMon || e.currency === filtroMon),
      ),
    [expenses, filtroCat, filtroMon],
  )

  const totales = useMemo(() => {
    const porMoneda = new Map<Moneda, number>()
    const porCategoria = new Map<string, Map<Moneda, number>>()
    for (const e of filtered) {
      porMoneda.set(e.currency, (porMoneda.get(e.currency) ?? 0) + e.amount)
      if (!porCategoria.has(e.categoria)) porCategoria.set(e.categoria, new Map())
      const cat = porCategoria.get(e.categoria)!
      cat.set(e.currency, (cat.get(e.currency) ?? 0) + e.amount)
    }
    return { porMoneda, porCategoria }
  }, [filtered])

  if (!expenses) return null

  return (
    <main className="page">
      <div className="page-title">
        <h2>Gastos</h2>
        <button
          className="btn-primary btn-sm"
          onClick={() =>
            setEditing({ fecha: hoy(), concepto: '', categoria: 'Comida', amount: 0, currency: 'USD', fxRate: null })
          }
        >
          + Gasto
        </button>
      </div>

      {expenses.length > 0 && (
        <div className="card totals">
          <div className="meta"><strong>Total {filtroCat || filtroMon ? '(filtrado)' : 'general'}</strong></div>
          {totales.porMoneda.size === 0 && <div className="meta">Sin gastos con estos filtros.</div>}
          {MONEDAS.filter((m) => totales.porMoneda.has(m)).map((m) => (
            <div className="total-row" key={m}>
              <span>{m}</span>
              <span className="amount">{fmtMonto(totales.porMoneda.get(m)!, m)}</span>
            </div>
          ))}
          {totales.porCategoria.size > 0 && <hr className="sep" />}
          {[...totales.porCategoria.entries()].map(([cat, monedas]) => (
            <div className="cat-row" key={cat}>
              <span>{cat}</span>
              <span>
                {MONEDAS.filter((m) => monedas.has(m))
                  .map((m) => fmtMonto(monedas.get(m)!, m))
                  .join(' · ')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="filters">
        <select value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={filtroMon} onChange={(e) => setFiltroMon(e.target.value)}>
          <option value="">Todas las monedas</option>
          {MONEDAS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      {expenses.length === 0 ? (
        <div className="empty">
          Todavía no hay gastos.
          <br />
          Agregá el primero con «+ Gasto».
        </div>
      ) : (
        <div className="card">
          {filtered.map((e) => (
            <div className="expense-row" key={e.id} onClick={() => setEditing(e)} style={{ cursor: 'pointer' }}>
              <div>
                <div>
                  <strong>{e.concepto}</strong>
                </div>
                <div className="meta">
                  {fmtDate(e.fecha)} · {e.categoria}
                </div>
              </div>
              <span className="amount">{fmtMonto(e.amount, e.currency)}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty">Nada que mostrar con estos filtros.</div>}
        </div>
      )}

      {editing && <ExpenseForm expense={editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function ExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [f, setF] = useState(expense)
  const monto = useMonto({ amount: expense.id ? expense.amount : null, currency: expense.currency }, true)

  async function save(e: FormEvent) {
    e.preventDefault()
    const m = monto.resolver()
    if (!m || m.amount === null) return
    const concepto = m.nota ? `${f.concepto} (${m.nota})` : f.concepto
    await db.expenses.put(withId({ ...f, concepto, amount: m.amount, currency: m.currency, fxRate: m.fxRate }))
    onClose()
  }
  async function remove() {
    if (f.id && confirm(`¿Borrar el gasto "${f.concepto}"?`)) {
      await db.expenses.delete(f.id)
      onClose()
    }
  }

  return (
    <Modal title={f.id ? 'Editar gasto' : 'Nuevo gasto'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Concepto">
          <input required value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} placeholder="Cena en Trastevere" />
        </Field>
        <div className="form-row">
          <Field label="Fecha">
            <input type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </Field>
          <Field label="Categoría">
            <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as Categoria })}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        {monto.campos}
        <FormActions onCancel={onClose} onDelete={f.id ? remove : undefined} />
      </form>
    </Modal>
  )
}
