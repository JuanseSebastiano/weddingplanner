import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base placeholder:text-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-soft disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
