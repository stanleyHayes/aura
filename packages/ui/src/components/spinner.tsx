import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

export function Spinner({
  className,
  label = "Loading",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex", className)} {...props}>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}…</span>
    </span>
  );
}
