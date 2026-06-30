import type { ReactNode } from "react";

/**
 * Replays a short fade + rise animation on every navigation. Mounted via each
 * route group's `template.tsx` — Next.js re-creates a `template.tsx` instance on
 * every navigation (unlike `layout.tsx`, which persists), so the CSS animation
 * runs again on each route change. Pure CSS, no JS; the `motion-safe:` variant
 * means it is automatically disabled under `prefers-reduced-motion: reduce`.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="motion-safe:animate-[page-enter_360ms_var(--ease-out-quart)]">
      {children}
    </div>
  );
}
