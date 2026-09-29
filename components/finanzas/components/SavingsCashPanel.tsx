import { useState, type FormEvent } from 'react';
import {
  SAVINGS_MOVEMENT_LABELS,
  formatCurrency,
  formatDate,
  type SavingsCash,
  type SavingsMovementWithRelations,
} from '@nf/shared';
import {
  useCreateSavingsWithdrawal,
  useDeleteSavingsMovement,
  useInvestFromSavings,
  useMe,
} from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FormError } from './States';

interface Props {
  cash: SavingsCash;
  movements: SavingsMovementWithRelations[];
  /** Formatea un monto en pesos según la moneda y el ojo de la pantalla. */
  format: (amountArs: number) => string;
  /** Tickers ya cargados, para autocompletar al invertir. */
  tickers: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

/** "1.234,56" -> 1234.56. Mismo parseo que el resto de los montos. */
function parseNumber(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

type Mode = 'none' | 'invest' | 'withdraw';

/**
 * La caja de ahorro: pesos que se apartaron y todavía no se invirtieron.
 *
 * Es el paso intermedio entre "guardé plata" y "compré algo con ella". La
 * plata entra desde el formulario de gastos eligiendo el destino Ahorros, y
 * de acá sale hacia una tenencia (invertir) o de vuelta a la cuenta
 * (retirar).
 */
export function SavingsCashPanel({ cash, movements, format, tickers }: Props) {
  const { compact } = useBreakpoint();
  const me = useMe();
  const invest = useInvestFromSavings();
  const withdraw = useCreateSavingsWithdrawal();
  const remove = useDeleteSavingsMovement();

  const [mode, setMode] = useState<Mode>('none');
  const [error, setError] = useState<string | null>(null);

  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [movedAt, setMovedAt] = useState(today());
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [note, setNote] = useState('');

  const parsedQuantity = parseNumber(quantity);
  const parsedPrice = parseNumber(price);
  // Lo que va a costar la compra, en vivo mientras se completa el formulario.
  const investTotal =
    Number.isFinite(parsedQuantity) && Number.isFinite(parsedPrice) && quantity && price
      ? parsedQuantity * parsedPrice
      : null;
  const overspends = investTotal !== null && investTotal > cash.available;

  const pending = invest.isPending || withdraw.isPending;

  function close() {
    setMode('none');
    setError(null);
    setTicker('');
    setQuantity('');
    setPrice('');
    setWithdrawAmount('');
    setNote('');
  }

  async function submitInvest(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!ticker.trim()) {
      setError('Ingresá el ticker tal como cotiza en BYMA, ej. AAPL.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Ingresá una cantidad mayor a cero.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Ingresá un precio por unidad mayor a cero.');
      return;
    }

    try {
      await invest.mutateAsync({
        ticker: ticker.trim().toUpperCase(),
        quantity: parsedQuantity,
        price: parsedPrice,
        moved_at: movedAt,
        notes: note.trim() || null,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar la inversión');
    }
  }

  async function submitWithdraw(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = parseNumber(withdrawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresá un monto mayor a cero.');
      return;
    }

    try {
      await withdraw.mutateAsync({
        amount: parsed,
        moved_at: movedAt,
        description: note.trim() || null,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar el retiro');
    }
  }

  const gridCols = compact ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))';

  return (
    <section
      className="flex animate-[nf-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-4 rounded-[18px] border border-accent/[0.22] px-6 py-[22px] shadow-card"
      style={{
        background:
          'linear-gradient(160deg, rgb(var(--nf-accent)/9%), rgb(var(--nf-card)) 60%)',
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-mono text-[10.5px] tracking-[0.12em] text-accent-soft">
            EFECTIVO SIN INVERTIR
          </span>
          <span className="tabular text-[32px] font-semibold leading-none tracking-[-0.03em]">
            {format(cash.available)}
          </span>
          <span className="text-[12.5px] text-ink-secondary">
            {cash.deposited_this_month > 0
              ? `Apartaste ${format(cash.deposited_this_month)} este mes`
              : 'Este mes todavía no apartaste nada'}
            {cash.invested > 0 ? ` · ${format(cash.invested)} ya invertidos` : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="btn-primary"
            disabled={cash.available <= 0}
            title={cash.available <= 0 ? 'No hay efectivo sin invertir' : undefined}
            onClick={() => {
              setError(null);
              setMode((previous) => (previous === 'invest' ? 'none' : 'invest'));
            }}
          >
            {mode === 'invest' ? 'Cerrar' : 'Invertir'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={cash.available <= 0}
            onClick={() => {
              setError(null);
              setMode((previous) => (previous === 'withdraw' ? 'none' : 'withdraw'));
            }}
          >
            {mode === 'withdraw' ? 'Cerrar' : 'Retirar'}
          </button>
        </div>
      </div>

      {cash.available <= 0 && cash.deposited === 0 && (
        <p className="m-0 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
          Para apartar plata, cargá un movimiento en <strong>Gastos</strong> y elegí el destino{' '}
          <strong>Ahorros (transferencia)</strong>. No va a contar como gasto del mes: entra acá
          como pesos y desde este panel la asignás a la inversión que quieras.
        </p>
      )}

      {mode === 'invest' && (
        <form onSubmit={submitInvest} className="flex flex-col gap-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: gridCols }}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-ink-muted">Ticker (BYMA)</span>
              <input
                className="input font-mono uppercase"
                placeholder="AAPL"
                list="nf-tickers"
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                required
              />
              <datalist id="nf-tickers">
                {tickers.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
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
              <span className="text-[11.5px] text-ink-muted">Precio por unidad (ARS)</span>
              <input
                className="input tabular text-right"
                inputMode="decimal"
                placeholder="21.000,00"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-ink-muted">Fecha</span>
              <input
                type="date"
                className="input tabular"
                value={movedAt}
                onChange={(event) => setMovedAt(event.target.value)}
                required
              />
            </label>
          </div>

          <p className="m-0 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
            {investTotal === null ? (
              <>
                El total sale de cantidad × precio y se descuenta del efectivo sin invertir. Si ya
                tenés ese CEDEAR, la app recalcula sola el costo promedio ponderado.
              </>
            ) : (
              <>
                Sale <strong className="text-ink-primary">{formatCurrency(investTotal)}</strong> y
                quedarían{' '}
                <strong className={overspends ? 'text-danger' : 'text-ink-primary'}>
                  {formatCurrency(cash.available - investTotal)}
                </strong>{' '}
                en la caja.
                {overspends && ' No alcanza: apartá más plata o comprá menos cantidad.'}
              </>
            )}
          </p>

          {error && <FormError message={error} />}

          <div className="flex flex-wrap justify-end gap-2.5">
            <button type="button" className="btn-secondary" onClick={close}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={pending || overspends}>
              {pending ? 'Guardando…' : 'Invertir'}
            </button>
          </div>
        </form>
      )}

      {mode === 'withdraw' && (
        <form onSubmit={submitWithdraw} className="flex flex-col gap-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: gridCols }}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-ink-muted">Monto (ARS)</span>
              <input
                className="input tabular text-right"
                inputMode="decimal"
                placeholder="50.000,00"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-ink-muted">Fecha</span>
              <input
                type="date"
                className="input tabular"
                value={movedAt}
                onChange={(event) => setMovedAt(event.target.value)}
                required
              />
            </label>

            <label className={`flex flex-col gap-1.5 ${compact ? '' : '[grid-column:span_2]'}`}>
              <span className="text-[11.5px] text-ink-muted">Motivo (opcional)</span>
              <input
                className="input"
                placeholder="Para la cuota del auto"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>

          <p className="m-0 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
            La plata vuelve a estar disponible fuera de ahorros. No se registra como ingreso: nunca
            dejó de ser tuya, solo cambia de lugar otra vez.
          </p>

          {error && <FormError message={error} />}

          <div className="flex flex-wrap justify-end gap-2.5">
            <button type="button" className="btn-secondary" onClick={close}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Guardando…' : 'Retirar'}
            </button>
          </div>
        </form>
      )}

      {movements.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[12.5px] text-accent-soft">
            Ver los {movements.length} movimientos de la caja
          </summary>
          <ul className="m-0 mt-2.5 flex max-h-[320px] list-none flex-col gap-1 overflow-y-auto p-0">
            {movements.map((movement) => {
              const income = movement.kind === 'deposit';
              return (
                <li
                  key={movement.id}
                  className="flex items-center justify-between gap-3 border-b border-wash/[0.05] py-2 last:border-0"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12.5px] text-ink-primary">
                      {SAVINGS_MOVEMENT_LABELS[movement.kind]}
                      {movement.holding ? ` · ${movement.holding.ticker}` : ''}
                    </span>
                    <span className="truncate font-mono text-[10.5px] text-ink-faint">
                      {formatDate(movement.moved_at)}
                      {movement.profile ? ` · ${movement.profile.display_name}` : ''}
                      {movement.description ? ` · ${movement.description}` : ''}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={`tabular text-[12.5px] font-semibold ${
                        income ? 'text-accent' : 'text-ink-soft'
                      }`}
                    >
                      {income ? '+' : '−'}
                      {format(Number(movement.amount)).replace(/^[+\-−]\s*/, '')}
                    </span>
                    {movement.kind !== 'investment' && movement.user_id === me.data?.user.id && (
                      <button
                        type="button"
                        className="text-[10.5px] text-ink-faint underline hover:text-danger"
                        onClick={() => remove.mutate(movement.id)}
                      >
                        borrar
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
