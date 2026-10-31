import { useState } from 'react';
import { formatCurrency, formatMonthLabel, parseAmount, type MonthlyPlanRubro } from '@nf/shared';
import {
  useCreateBudget,
  useDeleteBudget,
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

/** Monto editable en el lugar: Enter o salir del campo guarda; vacío o 0 lo saca. */
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
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (borrador === null) return;
    const vacio = borrador.trim() === '';
    const monto = vacio ? null : parseAmount(borrador);
    setBorrador(null);
    // Texto que no es un número: no se toca nada (null acá sacaría el tope).
    if (!vacio && (monto === null || monto < 0)) return;
    if (monto === (valor || null)) return;
    setGuardando(true);
    try {
      await onGuardar(monto === 0 ? null : monto);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <input
      className="input tabular w-[130px] shrink-0 text-right"
      inputMode="decimal"
      placeholder="Sin tope"
      aria-label={etiqueta}
      disabled={guardando}
      value={borrador ?? (valor ? valor.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '')}
      onFocus={(e) => setBorrador(e.currentTarget.value)}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={() => void guardar()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setBorrador(null);
      }}
    />
  );
}

function Rubro({ r, onError }: { r: MonthlyPlanRubro; onError: (m: string | null) => void }) {
  const crear = useCreateBudget();
  const actualizar = useUpdateBudget();
  const borrar = useDeleteBudget();
  const setVariable = useSetCategoryVariable();

  async function guardarTope(monto: number | null) {
    onError(null);
    try {
      if (monto === null) {
        if (r.budget_id) await borrar.mutateAsync(r.budget_id);
      } else if (r.budget_id) {
        await actualizar.mutateAsync({ id: r.budget_id, amount: monto });
      } else if (r.category_id) {
        await crear.mutateAsync({ category_id: r.category_id, amount: monto });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No pudimos guardar el tope');
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
        {r.category_id ? (
          <Monto valor={r.amount || null} etiqueta={`Tope de ${r.name}`} onGuardar={guardarTope} />
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
  const { data, isLoading } = useMonthlyPlan();
  const setCap = useSetMonthlyCap();
  const [error, setError] = useState<string | null>(null);
  if (isLoading || !data) return null;

  const estadoTotal = data.cap === null ? 'ok' : data.spent > data.cap ? 'exceeded' : data.spent >= data.cap * 0.8 ? 'warning' : 'ok';

  async function guardarTope(monto: number | null) {
    setError(null);
    try {
      await setCap.mutateAsync(monto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar el tope');
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">{formatMonthLabel(data.month).toUpperCase()}</span>
        <h1 className="m-0 font-serif text-2xl font-normal lg:text-[28px]">Presupuesto mensual</h1>
      </div>

      <div className="card flex flex-col gap-4 px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="eyebrow">TOPE DEL MES</span>
            <span className="text-xs text-ink-faint">Los rubros no pueden sumar más que esto.</span>
          </div>
          <Monto valor={data.cap} etiqueta="Tope mensual" onGuardar={guardarTope} />
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
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
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
            <Rubro key={r.category_id ?? 'sin-rubro'} r={r} onError={setError} />
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
