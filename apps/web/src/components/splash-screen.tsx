import { Brand } from "@/components/brand";

export function SplashScreen() {
  return (
    <div
      role="status"
      aria-label="Loading AURA"
      className="grid min-h-dvh place-items-center bg-[var(--color-background)] px-4"
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="aura-splash-mark rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_24px_80px_color-mix(in_oklch,var(--color-ink-950)_12%,transparent)]">
          <Brand className="[&_span:first-child]:size-12 [&_span:first-child_svg]:size-8 [&_span:last-child]:text-2xl" />
        </div>
        <p className="mt-5 text-sm font-medium text-[var(--color-muted-foreground)]">
          Preparing your campus workspace
        </p>
        <div
          aria-hidden="true"
          className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-[var(--color-muted)]"
        >
          <span className="aura-splash-progress block h-full w-1/2 rounded-full bg-[var(--color-maroon)]" />
        </div>
      </div>
    </div>
  );
}
