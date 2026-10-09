import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  /** Dato de contexto, en mono, alineado a la derecha del título. */
  meta?: string;
  children: ReactNode;
  /** Retardo de entrada, para escalonar las tarjetas del dashboard. */
  delay?: string;
  className?: string;
}

export function ChartCard({ title, meta, children, delay = '0ms', className = '' }: ChartCardProps) {
  return (
    <section
      className={`card flex flex-col gap-[18px] px-6 py-[22px] animate-[nf-rise_420ms_cubic-bezier(0.22,1,0.36,1)_both] ${className}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 shrink-0 font-serif text-xl font-normal leading-tight">{title}</h2>
        {meta && <span className="text-right text-[10.5px] text-ink-faint">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
