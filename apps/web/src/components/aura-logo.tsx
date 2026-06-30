import * as React from "react";
import { cn } from "@cbs/ui/lib/cn";

/**
 * The AURA mark (BRAND.md §Logo concept): a stylised "A" formed from a campus
 * roofline and booking pin. Drawn in `currentColor` so it inherits maroon or
 * paper and works as the header mark, auth motif, and app icon source.
 */
export function AuraLogo({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-8", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {/* Campus roof / A silhouette. */}
      <path
        d="M4.75 27.25 16 4.75l11.25 22.5"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Reservation floor line. */}
      <path
        d="M9.25 21.25h13.5"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Booking pin nested in the apex. */}
      <path
        d="M16 9.25c-2.35 0-4.25 1.8-4.25 4.02 0 2.84 4.25 6.73 4.25 6.73s4.25-3.89 4.25-6.73c0-2.22-1.9-4.02-4.25-4.02Z"
        fill="currentColor"
      />
      <circle
        cx="16"
        cy="13.22"
        r="1.28"
        fill="var(--aura-logo-pin-dot, var(--color-background, #fff))"
      />
    </svg>
  );
}
