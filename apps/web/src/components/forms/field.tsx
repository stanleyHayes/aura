"use client";

import * as React from "react";
import { Label } from "@cbs/ui/components/label";
import { cn } from "@cbs/ui/lib/cn";

/**
 * Accessible field wrapper (§12.2): associates label, description and error
 * with the control via ids and `aria-describedby` / `aria-invalid`.
 */
export function Field({
  id,
  label,
  error,
  description,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}) {
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-0.5 text-[var(--color-destructive)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {description ? (
        <p id={descId} className="text-xs text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={errId} role="alert" className="text-xs text-[var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
