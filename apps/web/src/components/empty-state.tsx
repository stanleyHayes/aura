import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@cbs/ui/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actions,
  variant = "default",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "default" | "table";
  className?: string;
}) {
  const renderedActions = actions ?? action;
  const isTable = variant === "table";

  return (
    <div
      role="status"
      className={cn(
        "relative overflow-hidden px-6 py-14 text-center",
        isTable
          ? "rounded-none border-0 bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] shadow-none"
          : "rounded-2xl border border-[color-mix(in_oklch,var(--color-maroon)_24%,var(--color-border))] bg-[color-mix(in_oklch,var(--color-maroon)_4%,var(--color-card))] shadow-[0_18px_55px_color-mix(in_oklch,var(--color-ink-950)_8%,transparent)]",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 top-8 size-40 rotate-6 text-[color-mix(in_oklch,var(--color-maroon)_7%,transparent)]"
      />
      <span
        aria-hidden="true"
        className="absolute left-6 top-6 size-8 border-l border-t border-[color-mix(in_oklch,var(--color-maroon)_30%,transparent)]"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-6 right-6 size-8 border-b border-r border-[color-mix(in_oklch,var(--color-maroon)_30%,transparent)]"
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-px w-28 -translate-x-1/2 bg-[color-mix(in_oklch,var(--color-maroon)_34%,transparent)]"
      />
      <span className="relative mx-auto grid size-20 place-items-center">
        <span
          aria-hidden="true"
          className="absolute inset-2 rotate-6 rounded-2xl border border-[color-mix(in_oklch,var(--color-maroon)_22%,var(--color-border))] bg-[var(--color-card)]"
        />
        <span
          aria-hidden="true"
          className={cn(
            "aura-empty-icon relative grid size-14 place-items-center rounded-xl border border-[color-mix(in_oklch,var(--color-maroon)_22%,var(--color-border))] text-[var(--color-maroon)] shadow-sm",
            isTable
              ? "bg-[color-mix(in_oklch,var(--color-maroon)_10%,var(--color-card))] dark:text-[var(--color-maroon-tint)]"
              : "bg-[color-mix(in_oklch,var(--color-maroon-tint)_82%,var(--color-card))]",
          )}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
      </span>
      <h3 className="relative mt-5 text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
        {title}
      </h3>
      {description ? (
        <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {renderedActions ? (
        <div className="relative mx-auto mt-6 flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center [&_a]:w-full [&_a]:justify-center sm:[&_a]:w-auto [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto">
          {renderedActions}
        </div>
      ) : null}
    </div>
  );
}
