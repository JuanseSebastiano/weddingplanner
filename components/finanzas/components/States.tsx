import type { ReactNode } from 'react';

/**
 * Estados compartidos de carga, vacío y error.
 *
 * Van juntos a propósito: son los tres momentos en que una app se siente
 * rota si nadie los diseñó, y los tres tienen que dar la misma sensación
 * de producto que la pantalla con datos.
 */

/** Bloque con brillo de carga. Reserva el alto real para que nada salte. */
export function Skeleton({ height, className = '' }: { height: number | string; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height }} aria-hidden />;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  children?: ReactNode;
  /** Menta cuando no hay nada que hacer y está bien; neutro por defecto. */
  tone?: 'neutral' | 'accent';
}

export function EmptyState({ title, description, children, tone = 'neutral' }: EmptyStateProps) {
  const accent = tone === 'accent';
  return (
    <div
      className={`flex animate-[nf-rise_380ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col items-start gap-3.5 rounded-[18px] border border-dashed px-8 py-11 ${
        accent
          ? 'border-accent/30 bg-gradient-to-b from-accent/[0.06] to-sunken'
          : 'border-wash/[0.14] bg-sunken'
      }`}
    >
      <div
        className={`h-9 w-9 rounded-xl border ${
          accent ? 'border-accent/30 bg-accent/[0.16]' : 'border-accent/25 bg-accent/[0.12]'
        }`}
        aria-hidden
      />
      <h2 className="m-0 font-serif text-xl font-normal leading-tight">{title}</h2>
      {description && (
        <p className="m-0 max-w-[52ch] text-sm leading-relaxed text-ink-secondary [text-wrap:pretty]">
          {description}
        </p>
      )}
      {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
    </div>
  );
}

interface ErrorStateProps {
  /** Endpoint o contexto: ayuda a saber qué falló sin abrir la consola. */
  source?: string;
  title: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ source, title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3.5 rounded-[18px] border border-danger-strong/[0.28] bg-gradient-to-b from-danger-strong/[0.08] to-danger-strong/[0.02] px-8 py-8">
      {source && (
        <span className="text-[11px] tracking-[0.1em] text-danger">{source}</span>
      )}
      <h2 className="m-0 font-serif text-xl font-normal leading-tight">{title}</h2>
      {description && (
        <p className="m-0 max-w-[52ch] text-sm leading-relaxed text-ink-secondary [text-wrap:pretty]">
          {description}
        </p>
      )}
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Mensaje corto de error dentro de un formulario. */
export function FormError({ message }: { message: string }) {
  return (
    <p className="m-0 rounded-xl border border-danger-strong/25 bg-danger-strong/[0.08] px-3 py-2 text-[13px] text-danger">
      {message}
    </p>
  );
}
