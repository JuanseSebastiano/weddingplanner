import { useEffect, useState, type FormEvent } from 'react';
import type { HoldingWithRelations } from '@nf/shared';
import { useCreateHolding, useUpdateHolding } from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FormError } from './States';

interface Props {
  /** Si viene, el formulario edita en vez de crear. */
  holding?: HoldingWithRelations | null;
  onDone?: () => void;
  onCancel?: () => void;
}

/** "1.234,56" -> 1234.56. Mismo parseo que el resto de los montos de la app. */
function parseNumber(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

export function HoldingForm({ holding, onCancel, onDone }: Props) {
  const create = useCreateHolding();
  const update = useUpdateHolding();
  const { compact } = useBreakpoint();

  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [broker, setBroker] = useState('Balanz');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTicker(holding?.ticker ?? '');
    setQuantity(holding ? String(holding.quantity).replace('.', ',') : '');
    setAvgCost(
      holding
        ? Number(holding.avg_cost).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '',
    );
    setBroker(holding?.broker ?? 'Balanz');
    setNotes(holding?.notes ?? '');
    setError(null);
  }, [holding]);

  const pending = create.isPending || update.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedQuantity = parseNumber(quantity);
    const parsedAvgCost = parseNumber(avgCost);
    if (!ticker.trim()) {
      setError('Ingresá el ticker tal como cotiza en BYMA, ej. AAPL.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Ingresá una cantidad mayor a cero.');
      return;
    }
    if (!Number.isFinite(parsedAvgCost) || parsedAvgCost <= 0) {
      setError('Ingresá un costo promedio mayor a cero.');
      return;
    }

    const payload = {
      ticker: ticker.trim().toUpperCase(),
      quantity: parsedQuantity,
      avg_cost: parsedAvgCost,
      broker: broker.trim() || 'Balanz',
      notes: notes.trim() || null,
    };

    try {
      if (holding) await update.mutateAsync({ id: holding.id, ...payload });
      else await create.mutateAsync(payload);

      if (!holding) {
        setTicker('');
        setQuantity('');
        setAvgCost('');
        setNotes('');
      }
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar la tenencia');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex animate-[nf-rise_300ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-4 rounded-[18px] border border-accent/[0.22] px-6 py-[22px]"
      style={{
        background:
          'linear-gradient(180deg, rgb(var(--nf-accent)/6%), rgb(var(--nf-card)) 60%)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">
          {holding ? `Editar ${holding.ticker}` : 'Nueva tenencia'}
        </h2>
        <span className="text-[10.5px] text-ink-faint">
          {holding ? `PATCH /api/holdings/${holding.id.slice(0, 8)}` : 'POST /api/holdings'}
        </span>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))' }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Ticker (BYMA)</span>
          <input
            className="input uppercase"
            placeholder="AAPL"
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            disabled={Boolean(holding)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Cantidad</span>
          <input
            className="input tabular text-right"
            inputMode="decimal"
            placeholder="10"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Costo promedio (ARS)</span>
          <input
            className="input tabular text-right"
            inputMode="decimal"
            placeholder="18.500,00"
            value={avgCost}
            onChange={(event) => setAvgCost(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-ink-muted">Broker</span>
          <input
            className="input"
            placeholder="Balanz"
            value={broker}
            onChange={(event) => setBroker(event.target.value)}
          />
        </label>

        <label className={`flex flex-col gap-1.5 ${compact ? '' : '[grid-column:span_2]'}`}>
          <span className="text-[11.5px] text-ink-muted">Notas (opcional)</span>
          <input
            className="input"
            placeholder="Compra de julio"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>

      {holding && (
        <p className="m-0 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
          El ticker no se puede editar: si te equivocaste, borrá esta posición y cargala de nuevo.
          Si compraste más de {holding.ticker}, recalculá vos el costo promedio antes de guardar —
          la app no lo hace sola.
        </p>
      )}

      {error && <FormError message={error} />}

      <div className="flex flex-wrap justify-end gap-2.5">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : holding ? 'Guardar cambios' : 'Guardar tenencia'}
        </button>
      </div>
    </form>
  );
}
