"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { Brand } from "@/components/brand";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(observability): forward to Sentry (@sentry/nextjs) per §15.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh bg-[var(--color-background)] px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <Brand />
        <main className="grid flex-1 place-items-center py-12">
          <section
            aria-labelledby="error-title"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[color-mix(in_oklch,var(--color-destructive)_28%,var(--color-border))] bg-[var(--color-card)] p-6 text-center shadow-[0_24px_80px_color-mix(in_oklch,var(--color-ink-950)_12%,transparent)] md:p-8"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color-mix(in_oklch,var(--color-destructive)_12%,transparent)] blur-2xl"
            />
            <span className="relative mx-auto grid size-14 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--color-destructive)_12%,transparent)] text-[var(--color-destructive)]">
              <TriangleAlert className="size-7" aria-hidden="true" />
            </span>
            <h1
              id="error-title"
              className="relative mt-5 text-2xl font-semibold tracking-tight"
            >
              Something interrupted AURA
            </h1>
            <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--color-muted-foreground)]">
              The page could not finish loading. Try again, or return home and
              reopen the workspace from there.
            </p>
            {error.digest ? (
              <p className="relative mt-4 font-mono text-xs text-[var(--color-muted-foreground)]">
                Reference {error.digest}
              </p>
            ) : null}
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <Button onClick={reset}>
                <RefreshCw className="size-4" />
                Try again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <Home className="size-4" />
                  Return home
                </Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
