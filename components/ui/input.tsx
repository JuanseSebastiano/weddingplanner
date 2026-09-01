import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-base placeholder:text-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-soft disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
