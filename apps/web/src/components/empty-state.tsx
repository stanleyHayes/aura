import * as React from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-serif text-lg tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
