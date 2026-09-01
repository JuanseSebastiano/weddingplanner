import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
      {...props}
    />
  );
}

/** Título de sección: la serif es lo que le da el aire editorial. */
export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-serif text-xl font-normal leading-tight", className)}
      {...props}
    />
  );
}

/** Rótulo en versalitas para encabezar un dato. */
export function Eyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.09em] text-subtle",
        className,
      )}
      {...props}
    />
  );
}
