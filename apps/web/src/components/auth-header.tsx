"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";

/**
 * Auth-screen header (DESIGN.md §2 + §12): a page icon, title, description and a
 * help popover with a short "how to" walk-through. The icon is passed as a
 * rendered element so a Server Component page can supply a lucide icon without
 * tripping the Server→Client function-prop boundary.
 */
export function AuthHeader({
  icon,
  title,
  description,
  help,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  help?: { title?: string; steps: string[] };
}) {
  return (
    <div className="flex flex-col gap-4">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]"
      >
        {icon}
      </span>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        </div>
        {help ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="How this works"
                className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-maroon)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-maroon)]"
              >
                <HelpCircle className="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
                {help.title ?? "How this works"}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-[var(--color-muted-foreground)]">
                {help.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
