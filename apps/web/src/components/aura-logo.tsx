import * as React from "react";
import { cn } from "@cbs/ui/lib/cn";

/**
 * The AURA mark (BRAND.md §Logo concept): a stylised "A" whose silhouette reads
 * as a building/campus gable, with a location pin nested inside the apex to
 * signal reservations. Drawn in `currentColor` so it inherits maroon (or paper
 * on the brand panel) and works as the header mark, the login mark, and — via
 * `icon.svg` — the favicon / app icon. Decorative; callers label the lockup.
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
      {/* The "A" gable — two legs rising to a campus-roof apex. */}
      <path
        d="M5 28 L16 4 L27 28"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Cross-bar / floor line of the building. */}
      <path
        d="M10 20 L22 20"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Location pin nested in the apex — a reservation marker. */}
      <circle cx="16" cy="13.2" r="2.4" fill="currentColor" />
    </svg>
  );
}
