import { useState } from 'react';
import { formatCurrency, formatMonthLabel, type MonthlyPlanRubro } from '@nf/shared';
import {
  useCreateBudget,
  useDeleteBudget,
  useMe,
  useMonthlyPlan,
  useSetCategoryVariable,
  useSetMonthlyCap,
  useUpdateBudget,
} from '../hooks/queries';

const COLOR_ESTADO = { ok: 'bg-sage', warning: 'bg-warning', exceeded: 'bg-danger' } as const;

function Barra({ valor, total, estado }: { valor: number; total: number; estado: keyof typeof COLOR_ESTADO }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : valor > 0 ? 100 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div className={`h-full rounded-full ${COLOR_ESTADO[estado]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "1.500.000" o "1500000,50" → número: punto de miles y coma decimal, como se escribe acá. */
function leerMonto(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Monto editable en el lugar: Enter o salir del campo guarda; vacío o 0 lo
 * saca. Muestra lo guardado al instante, sin esperar al servidor, y si el
 * servidor lo rechaza vuelve a lo escrito con el motivo debajo.
 */
function Monto({
  valor,
  etiqueta,
  onGuardar,
}: {
  valor: number | null;
  etiqueta: string;
  onGuardar: (monto: number | null) => Promise<unknown>;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  // Lo recién guardado, hasta que el dato del servidor cambie.
  const [optimista, setOptimista] = useState<{ monto: number | null; de: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mostrado = optimista && optimista.de === valor ? optimista.monto : valor;

  async function guardar() {
    if (borrador === null) return;
    const texto = borrador;
    setBorrador(null);
    const vacio = texto.trim() === '';
    const monto = vacio ? null : leerMonto(texto);
    if (!vacio && monto === null) {
      setBorrador(texto);
      setError('Escribí un número, por ejemplo 150.000');
      return;
    }
    const nuevo = monto === 0 ? null : monto;
    setError(null);
    if (nuevo === (mostrado || null)) return;
    setOptimista({ monto: nuevo, de: valor });
    try {
      await onGuardar(nuevo);
    } catch (err) {
      setOptimista(null);
      setBorrador(texto);
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <input
        className={`input tabular w-[130px] text-right ${error ? 'border-danger' : ''}`}
        inputMode="decimal"
        placeholder="Sin tope"
        aria-label={etiqueta}
        aria-invalid={Boolean(error)}
        value={borrador ?? (mostrado ? mostrado.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '')}
        onFocus={(e) => {
          if (borrador === null) setBorrador(mostrado ? String(mostrado).replace('.', ',') : '');
          const input = e.currentTarget;
          requestAnimationFrame(() => input.select());
        }}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => void guardar()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setBorrador(null);
            setError(null);
          }
        }}
      />
      {error && <span className="max-w-[260px] text-right text-[11px] leading-snug text-danger">{error}</span>}
    </div>
  );
}

function Rubro({
  r,
  userId,
}: {
  r: MonthlyPlanRubro;
  /** null = vista de los dos: solo lectura. */
  userId: string | null;
}) {
  const crear = useCreateBudget();
  const actualizar = useUpdateBudget();
  const borrar = useDeleteBudget();
  const setVariable = useSetCategoryVariable();

  // Los errores los muestra el campo, debajo del monto.
  async function guardarTope(monto: number | null) {
    if (monto === null) {
      if (r.budget_id) await borrar.mutateAsync(r.budget_id);
    } else if (r.budget_id) {
      await actualizar.mutateAsync({ id: r.budget_id, amount: monto });
    } else if (r.category_id && userId) {
      await crear.mutateAsync({ category_id: r.category_id, amount: monto, user_id: userId });
    }
  }

  return (
    <li className="flex flex-col gap-2 border-t border-wash/[0.08] py-3 first:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink-bright">{r.name}</span>
        {r.category_id && (
          <button
            type="button"
            onClick={() => setVariable.mutate({ categoryId: r.category_id!, variable: !r.variable })}
            disabled={setVariable.isPending}
            title={r.variable ? 'Absorbe lo que se pasan los demás rubros' : 'Tocá para marcarlo como variable'}
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] ${
              r.variable ? 'border-accent bg-accent/[0.08] text-accent' : 'border-wash/[0.12] text-ink-secondary'
            }`}
          >
            {r.variable ? 'Variable' : 'Fijo'}
          </button>
        )}
        {r.category_id && userId ? (
          <Monto valor={r.amount || null} etiqueta={`Tope de ${r.name}`} onGuardar={guardarTope} />
        ) : r.category_id ? (
          <span className="tabular w-[130px] text-right text-[13px] text-ink-primary">
            {r.amount ? formatCurrency(r.amount) : 'Sin tope'}
          </span>
        ) : (
          <span className="w-[130px] text-right text-xs text-ink-faint">Asigná un rubro</span>
        )}
      </div>
      <Barra valor={r.spent} total={r.adjusted} estado={r.amount > 0 || r.spent === 0 ? r.state : 'exceeded'} />
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-ink-secondary">
        <span className="tabular">
          Gastado {formatCurrency(r.spent)}
          {r.cut > 0 && <span className="text-danger"> · recortado {formatCurrency(r.cut)}</span>}
        </span>
        {r.amount > 0 ? (
          <span className={`tabular ${r.remaining < 0 ? 'text-danger' : ''}`}>
            {r.remaining < 0 ? 'Pasado ' : 'Quedan '}
            {formatCurrency(Math.abs(r.remaining))}
          </span>
        ) : (
          r.spent > 0 && <span className="text-danger">Sin tope: se descuenta de los variables</span>
        )}
      </div>
    </li>
  );
}

/**
 * Presupuesto del mes: un tope total y topes por rubro que no pueden
 * sumar más. Lo que un rubro se pasa se recorta de los variables.
 */
export function PresupuestoMensualPage() {
  const me = useMe();
  // undefined = todavía no eligió: arranca en el propio.
  const [elegido, setElegido] = useState<string | null | undefined>(undefined);
  const userId = elegido === undefined ? (me.data?.user.id ?? null) : elegido;
  const { data, isPlaceholderData } = useMonthlyPlan(userId);
  const setCap = useSetMonthlyCap();
  if (!data || !me.data) return null;

  const members = me.data.members;
  const opciones = members.length > 1 ? [...members, { id: null, display_name: 'Juntos' }] : members;

  const estadoTotal = data.cap === null ? 'ok' : data.spent > data.cap ? 'exceeded' : data.spent >= data.cap * 0.8 ? 'warning' : 'ok';

  async function guardarTope(monto: number | null) {
    if (userId) await setCap.mutateAsync({ amount: monto, user_id: userId });
  }

  return (
    <div className={`flex flex-col gap-[18px] transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">{formatMonthLabel(data.month).toUpperCase()}</span>
        <h1 className="m-0 font-serif text-2xl font-normal lg:text-[28px]">Presupuesto mensual</h1>
      </div>

      {opciones.length > 1 && (
        <div role="group" aria-label="Presupuesto de" className="inline-flex self-start rounded-full border border-wash/[0.08] bg-sunken p-0.5">
          {opciones.map((o) => (
            <button
              key={o.id ?? 'juntos'}
              type="button"
              aria-pressed={userId === o.id}
              onClick={() => setElegido(o.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                userId === o.id ? 'bg-accent text-accent-on' : 'text-ink-secondary'
              }`}
            >
              {o.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="card flex flex-col gap-4 px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="eyebrow">TOPE DEL MES</span>
            <span className="text-xs text-ink-faint">
              {userId
                ? 'Los rubros no pueden sumar más que esto. Cuenta lo que cargó esta persona.'
                : 'La suma de los presupuestos de cada uno. Se edita en la pestaña de cada persona.'}
            </span>
          </div>
          {userId ? (
            <Monto key={userId} valor={data.cap} etiqueta="Tope mensual" onGuardar={guardarTope} />
          ) : (
            <span className="tabular text-[15px] font-semibold text-ink-primary">
              {data.cap === null ? 'Sin tope' : formatCurrency(data.cap)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-wash/[0.08] pt-4 sm:grid-cols-4">
          <Dato label="Asignado a rubros" valor={formatCurrency(data.assigned)} />
          <Dato
            label="Sin asignar"
            valor={data.unassigned === null ? '—' : formatCurrency(data.unassigned)}
          />
          <Dato label="Gastado" valor={formatCurrency(data.spent)} />
          <Dato
            label="Queda del tope"
            valor={data.cap === null ? '—' : formatCurrency(data.cap - data.spent)}
            alerta={data.cap !== null && data.spent > data.cap}
          />
        </div>
        {data.cap !== null && <Barra valor={data.spent} total={data.cap} estado={estadoTotal} />}
        {data.excess > 0 && (
          <p
            className={`m-0 rounded-xl px-3 py-2 text-xs ${
              data.uncovered > 0 ? 'bg-danger/[0.08] text-danger' : 'bg-accent/[0.07] text-ink-secondary'
            }`}
          >
            {data.uncovered > 0
              ? `Los rubros se pasaron ${formatCurrency(data.excess)} y a los variables ya no les queda: faltan ${formatCurrency(data.uncovered)}.`
              : `Los rubros se pasaron ${formatCurrency(data.excess)}: se recortó de los variables para no pasarse del tope.`}
          </p>
        )}
      </div>

      <div className="card flex flex-col px-[22px] py-5">
        <div className="mb-2 flex flex-col gap-0.5">
          <span className="eyebrow">RUBROS</span>
          <span className="text-xs text-ink-faint">
            Cargá el tope de cada rubro. Los variables absorben lo que se pasan los demás; tocá Fijo/Variable para cambiarlo.
          </span>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {data.rubros.map((r) => (
            <Rubro key={`${userId}-${r.category_id ?? 'sin-rubro'}`} r={r} userId={userId} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Dato({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className={`tabular text-[15px] font-semibold ${alerta ? 'text-danger' : 'text-ink-primary'}`}>{valor}</span>
    </div>
  );
}
