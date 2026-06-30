import Link from "next/link";
import type { Metadata } from "next";
import { Home, LogIn, MapPinned } from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="grid min-h-dvh bg-[var(--color-background)] px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <Brand />
        <main className="grid flex-1 place-items-center py-12">
          <section
            aria-labelledby="not-found-title"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center shadow-[0_24px_80px_color-mix(in_oklch,var(--color-ink-950)_12%,transparent)] md:p-8"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-14 -top-16 size-48 rounded-full bg-[color-mix(in_oklch,var(--color-maroon-tint)_54%,transparent)] blur-2xl"
            />
            <p className="relative font-mono text-sm font-medium text-[var(--color-maroon)] dark:text-[var(--color-maroon-tint)]">
              404
            </p>
            <span className="relative mx-auto mt-4 grid size-14 place-items-center rounded-xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
              <MapPinned className="size-7" aria-hidden="true" />
            </span>
            <h1
              id="not-found-title"
              className="relative mt-5 text-3xl font-semibold tracking-tight"
            >
              This space is not on the map
            </h1>
            <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--color-muted-foreground)]">
              The page may have moved, the link may be incomplete, or your
              account may not have access to that area.
            </p>
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/">
                  <Home className="size-4" />
                  Return home
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">
                  <LogIn className="size-4" />
                  Sign in
                </Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
