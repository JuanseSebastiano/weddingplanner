'use client';

import { useState } from 'react';
import { formatCurrency, type HoldingWithRelations } from '@nf/shared';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useDeleteHolding, useMe, usePortfolio, useSavings } from '../hooks/queries';
import { HoldingForm } from '../components/HoldingForm';
import { SavingsCashPanel } from '../components/SavingsCashPanel';
import { EmptyState, ErrorState, Skeleton } from '../components/States';

type Currency = 'ARS' | 'USD';

const HIDE_VALUES_KEY = 'nf-savings-hide-values';
const CURRENCY_KEY = 'nf-savings-currency';

/** Se guarda en localStorage: si lo activás, queda oculto también al recargar. */
function readHideValues(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HIDE_VALUES_KEY) === '1';
}

function readCurrency(): Currency {
  if (typeof window === 'undefined') return 'ARS';
  return window.localStorage.getItem(CURRENCY_KEY) === 'USD' ? 'USD' : 'ARS';
}

/**
 * Tapa un monto formateado conservando el signo y el símbolo de moneda —
 * "-$ 82.500,00" pasa a "-$ ••••••" y "US$ 654,32" a "US$ ••••••" — para
 * no perder la lectura rápida de si algo es positivo o negativo mientras
 * se oculta la cifra.
 */
function maskCurrency(formatted: string, hidden: boolean): string {
  if (!hidden) return formatted;
  const prefix = formatted.match(/^[+\-−]?\s*(US\$|\$)?\s*/)?.[0] ?? '';
  return `${prefix}••••••`;
}

/**
 * Un monto en pesos, convertido a la moneda elegida y formateado. Si se
 * pidió USD y no hay cotización del dólar, devuelve null — el llamador
 * decide cómo mostrar ese caso, no hay un número razonable que inventar.
 */
function convert(amountArs: number, currency: Currency, usdRate: number | null): number | null {
  if (currency === 'ARS') return amountArs;
  if (usdRate === null || usdRate <= 0) return null;
  return amountArs / usdRate;
}

function displayAmount(
  amountArs: number,
  currency: Currency,
  usdRate: number | null,
  hidden: boolean,
): string {
  const converted = convert(amountArs, currency, usdRate);
  if (converted === null) return '—';
  return maskCurrency(formatCurrency(converted, currency), hidden);
}

function displaySignedAmount(
  amountArs: number,
  currency: Currency,
  usdRate: number | null,
  hidden: boolean,
): string {
  const converted = convert(amountArs, currency, usdRate);
  if (converted === null) return '—';
  const sign = converted >= 0 ? '+' : '';
  return maskCurrency(`${sign}${formatCurrency(converted, currency)}`, hidden);
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Botón que alterna si se muestran los montos o solo el % de ganancia. */
function HideValuesToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-wash/[0.12] bg-raised text-ink-soft transition-colors hover:bg-raisedHover hover:text-ink-primary"
      onClick={onToggle}
      aria-pressed={hidden}
      title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
      aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

/**
 * Píldora ARS/USD. USD queda deshabilitado sin cotización del dólar.
 *
 * `active` es la moneda que se ve de verdad (no la preferencia guardada):
 * si se pidió USD pero la cotización no está, acá se resalta ARS para no
 * mostrar "USD" apretado mientras la pantalla dice pesos.
 */
function CurrencyToggle({
  active,
  canUseUsd,
  onChange,
}: {
  active: Currency;
  canUseUsd: boolean;
  onChange: (currency: Currency) => void;
}) {
  return (
    <div className="flex h-[42px] items-center gap-0.5 rounded-xl border border-wash/[0.12] bg-raised p-[3px]">
      {(['ARS', 'USD'] as const).map((option) => {
        const disabled = option === 'USD' && !canUseUsd;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            title={disabled ? 'Cotización del dólar no disponible' : undefined}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              active === option
                ? 'bg-accent/[0.16] text-accent'
                : disabled
                  ? 'cursor-not-allowed text-ink-faint'
                  : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            {option === 'USD' ? 'US$' : option}
          </button>
        );
      })}
    </div>
  );
}

/** "hace 2 min", "hace 1 h" — para la marca de tiempo de una cotización. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

interface StatProps {
  label: string;
  value: string;
  hint: string;
  tone: 'default' | 'positive' | 'negative';
}

function Stat({ label, value, hint, tone }: StatProps) {
  const border = {
    default: 'border-wash/[0.06]',
    positive: 'border-accent/[0.22]',
    negative: 'border-danger/[0.28]',
  }[tone];

  const text = {
    default: 'text-ink-strong',
    positive: 'text-accent',
    negative: 'text-danger',
  }[tone];

  return (
    <div
      className={`flex h-full animate-[nf-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col justify-between gap-3 rounded-[18px] border bg-card px-[22px] py-5 shadow-card ${border}`}
    >
      <span className="font-mono text-[10.5px] tracking-[0.12em] text-ink-faint">{label}</span>
      <span className={`tabular text-[27px] font-semibold tracking-[-0.02em] ${text}`}>{value}</span>
      <span className="text-xs leading-snug text-ink-secondary">{hint}</span>
    </div>
  );
}

/**
 * Vista previa de la cartera de CEDEARs.
 *
 * La tenencia se carga a mano — Balanz no tiene API pública para leerla —
 * y la cotización se resuelve sola contra una fuente de mercado pública.
 * Si esa fuente no responde, igual se muestra el costo cargado: la sección
 * nunca queda vacía por una falla externa que no depende de esta app.
 *
 * El ojo tapa los montos y deja solo el % de ganancia. El toggle ARS/USD
 * convierte todo a dólares al tipo de cambio CCL del día — el % de
 * ganancia no cambia con la moneda porque se divide costo y valor por el
 * mismo tipo de cambio, así que no hace falta recalcularlo.
 */
export function SavingsPage() {
  const { compact, cards } = useBreakpoint();
  const me = useMe();
  const portfolio = usePortfolio();
  const savings = useSavings();
  const removeHolding = useDeleteHolding();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HoldingWithRelations | null>(null);
  const [hidden, setHidden] = useState(readHideValues);
  const [currency, setCurrency] = useState<Currency>(readCurrency);

  const summary = portfolio.data;
  const positions = summary?.positions ?? [];
  const cash = summary?.cash ?? savings.data?.cash ?? null;
  const movements = savings.data?.movements ?? [];
  const usdRate = summary?.fx?.rate ?? null;
  const canUseUsd = usdRate !== null;
  // Si la moneda guardada es USD pero la cotización no está disponible en
  // esta carga, se ve en pesos en vez de una pantalla llena de guiones —
  // la preferencia queda guardada para cuando la fuente vuelva a responder.
  const effectiveCurrency: Currency = currency === 'USD' && canUseUsd ? 'USD' : 'ARS';

  const toggleHidden = () => {
    setHidden((previous) => {
      const next = !previous;
      window.localStorage.setItem(HIDE_VALUES_KEY, next ? '1' : '0');
      return next;
    });
  };

  const changeCurrency = (next: Currency) => {
    setCurrency(next);
    window.localStorage.setItem(CURRENCY_KEY, next);
  };

  const editHolding = (holding: HoldingWithRelations) => {
    setEditing(holding);
    setShowForm(false);
  };

  const closeForm = () => {
    setEditing(null);
    setShowForm(false);
  };

  const amount = (arsValue: number) => displayAmount(arsValue, effectiveCurrency, usdRate, hidden);
  const signedAmount = (arsValue: number) =>
    displaySignedAmount(arsValue, effectiveCurrency, usdRate, hidden);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">AHORROS · CEDEARS EN BALANZ</span>
          <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Cartera de inversión</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <CurrencyToggle active={effectiveCurrency} canUseUsd={canUseUsd} onChange={changeCurrency} />
          <HideValuesToggle hidden={hidden} onToggle={toggleHidden} />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setShowForm((previous) => !previous);
            }}
          >
            {showForm && !editing ? 'Cerrar formulario' : 'Nueva tenencia'}
          </button>
        </div>
      </div>

      {(showForm || editing) && (
        <HoldingForm holding={editing} onDone={closeForm} onCancel={closeForm} />
      )}

      {cash && (
        <SavingsCashPanel
          cash={cash}
          movements={movements}
          format={amount}
          tickers={positions.map((position) => position.ticker)}
        />
      )}

      {portfolio.error && (
        <ErrorState
          source="ERROR · /api/portfolio"
          title="No pudimos traer la cartera"
          description="Las tenencias cargadas están a salvo: esto es solo la lectura."
          onRetry={() => void portfolio.refetch()}
        />
      )}

      {portfolio.isLoading && (
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))' }}
        >
          <Skeleton height={126} />
          <Skeleton height={126} />
          <Skeleton height={126} />
        </div>
      )}

      {summary && positions.length > 0 && (
        <>
          {!summary.quotes_available && (
            <div className="card-sunken flex items-center gap-2.5 px-[18px] py-3">
              <span className="font-mono text-[10.5px] tracking-[0.08em] text-pending">
                COTIZACIONES NO DISPONIBLES
              </span>
              <span className="text-[12.5px] text-ink-secondary">
                No pudimos traer los precios en este momento. Se muestra el costo cargado; probá de
                nuevo en unos minutos.
              </span>
            </div>
          )}

          {currency === 'USD' && !canUseUsd && (
            <div className="card-sunken flex items-center gap-2.5 px-[18px] py-3">
              <span className="font-mono text-[10.5px] tracking-[0.08em] text-pending">
                COTIZACIÓN DEL DÓLAR NO DISPONIBLE
              </span>
              <span className="text-[12.5px] text-ink-secondary">
                No pudimos traer el tipo de cambio. Se muestra en pesos por ahora.
              </span>
            </div>
          )}

          {effectiveCurrency === 'USD' && summary.fx && (
            <div className="flex items-center gap-2 px-1">
              <span className="font-mono text-[10.5px] tracking-[0.08em] text-ink-faint">
                US$ 1 = {formatCurrency(summary.fx.rate)} · {summary.fx.source} ·{' '}
                {relativeTime(summary.fx.updated_at)}
              </span>
            </div>
          )}

          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))' }}
          >
            <Stat
              label="INVERTIDO"
              value={amount(summary.total_cost_basis)}
              hint={`${positions.length} ${positions.length === 1 ? 'tenencia' : 'tenencias'}`}
              tone="default"
            />
            <Stat
              label="VALOR DE MERCADO"
              value={summary.total_market_value === null ? '—' : amount(summary.total_market_value)}
              hint={
                summary.quoted_at
                  ? `Cotización ${relativeTime(summary.quoted_at)}`
                  : 'Sin cotización disponible'
              }
              tone="default"
            />
            <Stat
              label="GANANCIA / PÉRDIDA"
              value={summary.total_gain === null ? '—' : signedAmount(summary.total_gain)}
              hint={
                summary.total_gain_pct === null
                  ? 'Depende de la cotización'
                  : `${summary.total_gain_pct >= 0 ? '+' : ''}${summary.total_gain_pct
                      .toFixed(1)
                      .replace('.', ',')}% sobre lo invertido`
              }
              tone={summary.total_gain === null ? 'default' : summary.total_gain >= 0 ? 'positive' : 'negative'}
            />
          </div>
        </>
      )}

      {!portfolio.isLoading && !portfolio.error && positions.length === 0 && movements.length === 0 && (
        <EmptyState
          title="Todavía no cargaste ninguna tenencia"
          description="Cargá tus posiciones de CEDEARs tal como figuran en Balanz — ticker, cantidad y costo promedio — y la app resuelve sola la cotización actual."
        >
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Cargar la primera tenencia
          </button>
        </EmptyState>
      )}

      {positions.length > 0 && !cards && (
        <div className="overflow-hidden rounded-[18px] border border-wash/[0.06] bg-card shadow-card">
          <div
            className="grid gap-3 border-b border-wash/[0.06] bg-sunken px-5 py-3 font-mono text-[10.5px] tracking-[0.08em] text-ink-faint"
            style={{ gridTemplateColumns: '90px 90px 130px 130px 130px 120px 90px 80px' }}
          >
            <span>TICKER</span>
            <span className="text-right">CANTIDAD</span>
            <span className="text-right">COSTO PROM.</span>
            <span className="text-right">COTIZACIÓN</span>
            <span className="text-right">VALOR ACTUAL</span>
            <span className="text-right">GAN./PÉRD.</span>
            <span>QUIÉN</span>
            <span />
          </div>

          {positions.map((position, index) => {
            const hasQuote = position.market_value !== null && position.gain !== null;
            const positive = (position.gain ?? 0) >= 0;
            const isOwner = position.user_id === me.data?.user.id;

            return (
              <div
                key={position.id}
                className="grid animate-[nf-rise_320ms_ease_both] items-center gap-3 border-b border-wash/[0.04] px-5 py-3 transition-colors last:border-0 hover:bg-wash/[0.035]"
                style={{
                  gridTemplateColumns: '90px 90px 130px 130px 130px 120px 90px 80px',
                  animationDelay: `${Math.min(index, 12) * 35}ms`,
                }}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-[13px] font-semibold text-ink-primary">
                    {position.ticker}
                  </span>
                  <span className="truncate text-[10.5px] text-ink-faint">{position.broker}</span>
                </span>

                <span className="tabular text-right text-[13px] text-ink-soft">
                  {position.quantity}
                </span>

                <span className="tabular text-right text-[13px] text-ink-soft">
                  {amount(position.avg_cost)}
                </span>

                <span className="tabular text-right text-[13px] text-ink-soft">
                  {position.quote?.price !== null && position.quote?.price !== undefined
                    ? amount(position.quote.price)
                    : '—'}
                </span>

                <span className="tabular text-right text-[13px] font-semibold text-ink-strong">
                  {hasQuote ? amount(position.market_value as number) : '—'}
                </span>

                <span
                  className={`tabular text-right text-[12.5px] font-semibold ${
                    !hasQuote ? 'text-ink-faint' : positive ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {hasQuote
                    ? `${positive ? '+' : ''}${position.gain_pct?.toFixed(1).replace('.', ',')}%`
                    : '—'}
                </span>

                <span className="truncate text-[12.5px] text-ink-soft">
                  {position.profile?.display_name ?? '—'}
                </span>

                <span className="flex justify-end gap-2">
                  {isOwner && (
                    <>
                      <button
                        type="button"
                        className="text-[10.5px] text-ink-faint underline hover:text-accent-soft"
                        onClick={() => editHolding(position)}
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        className="text-[10.5px] text-ink-faint underline hover:text-danger"
                        onClick={() => {
                          if (confirm(`¿Borrar la posición en ${position.ticker}?`)) {
                            removeHolding.mutate(position.id);
                          }
                        }}
                      >
                        borrar
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {positions.length > 0 && cards && (
        <div className="flex flex-col gap-2.5">
          {positions.map((position, index) => {
            const hasQuote = position.market_value !== null && position.gain !== null;
            const positive = (position.gain ?? 0) >= 0;
            const isOwner = position.user_id === me.data?.user.id;

            return (
              <div
                key={position.id}
                className="flex animate-[nf-rise_320ms_ease_both] flex-col gap-2.5 rounded-[15px] border border-wash/[0.06] bg-card px-4 py-3.5"
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-[14.5px] font-semibold">{position.ticker}</span>
                    <span className="text-[11.5px] text-ink-secondary">
                      {position.quantity} · {position.broker}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="tabular text-[16px] font-semibold text-ink-strong">
                      {hasQuote ? amount(position.market_value as number) : '—'}
                    </span>
                    <span
                      className={`tabular text-[11.5px] font-semibold ${
                        !hasQuote ? 'text-ink-faint' : positive ? 'text-accent' : 'text-danger'
                      }`}
                    >
                      {hasQuote
                        ? `${positive ? '+' : ''}${position.gain_pct?.toFixed(1).replace('.', ',')}%`
                        : 'Sin cotización'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-wash/[0.05] text-[11.5px] text-ink-secondary">
                    Costo prom. {amount(position.avg_cost)}
                  </span>
                  <span className="chip bg-wash/[0.05] text-[11.5px] text-ink-secondary">
                    {position.profile?.display_name ?? '—'}
                  </span>
                  {isOwner && (
                    <span className="ml-auto flex gap-3">
                      <button
                        type="button"
                        className="text-[11.5px] text-ink-faint underline hover:text-accent-soft"
                        onClick={() => editHolding(position)}
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        className="text-[11.5px] text-ink-faint underline hover:text-danger"
                        onClick={() => {
                          if (confirm(`¿Borrar la posición en ${position.ticker}?`)) {
                            removeHolding.mutate(position.id);
                          }
                        }}
                      >
                        borrar
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
