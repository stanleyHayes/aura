import * as React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Standard page header (DESIGN.md §2): a leading page icon in a maroon-tinted
 * rounded container, the title, a one-line description, and a right-aligned
 * primary action. The icon is decorative (`aria-hidden`); the title carries the
 * meaning. `help` is an optional slot for the §2 how-to popover trigger.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  help,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]"
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
              {title}
            </h2>
            {help}
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
