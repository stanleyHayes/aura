/**
 * Brand palette — the single source of truth for AURA's Ashesi maroon anchors
 * and the shared neutral surfaces, framework-neutral (no React / RN / CSS).
 *
 * The web expresses colour in OKLCH via CSS custom properties
 * (`packages/ui/src/styles/tokens.css` + `globals.css`); those CSS files remain
 * the source of truth for the web's resolved theme variables. This module is the
 * JS source of truth for the raw brand hexes that both surfaces hardcode.
 */

/** Ashesi maroon anchors (BRAND.md exact hexes). */
export const brand = {
  maroon: "#7B1113",
  maroonDark: "#5E0D0F",
  maroonTint: "#F3E1E1",
} as const;

export type Brand = typeof brand;
