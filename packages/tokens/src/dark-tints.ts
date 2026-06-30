/**
 * Dark-tint catalogue — the single source of truth for the 9 AURA dark tints.
 *
 * Both surfaces share identical `value` / `label` / `description` metadata and
 * ordering. They differ only in how the 3 preview swatches are expressed:
 *
 * - The web renders OKLCH swatches (matching the `oklch()` values bound in
 *   `packages/ui/src/styles/tokens.css` / `globals.css`).
 * - Mobile renders sRGB hex swatches (React Native / NativeWind cannot evaluate
 *   `oklch()` natively).
 *
 * Both swatch tables live here so neither app duplicates the catalogue; each app
 * composes its own `DARK_TINT_OPTIONS` from this shared metadata, keeping its
 * existing public export surface byte-for-byte identical.
 */

/** Tint identity + copy — shared verbatim by web and mobile. Order is load-bearing. */
export const DARK_TINT_META = [
  {
    value: "ink",
    label: "Ink",
    description: "The current warm black AURA screen.",
  },
  {
    value: "burgundy",
    label: "Burgundy",
    description: "A deeper maroon cast for night work.",
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Cooler charcoal with a quiet blue undertone.",
  },
  {
    value: "canopy",
    label: "Canopy",
    description: "A calm green-black tint for low glare.",
  },
  {
    value: "slate",
    label: "Slate",
    description: "A neutral cool-grey screen with very little colour.",
  },
  {
    value: "ocean",
    label: "Ocean",
    description: "A deep blue-teal cast for focused evenings.",
  },
  {
    value: "plum",
    label: "Plum",
    description: "A soft violet-black for a warmer night mood.",
  },
  {
    value: "espresso",
    label: "Espresso",
    description: "A warm brown-black, easy on the eyes at night.",
  },
  {
    value: "rose",
    label: "Rose",
    description: "A muted dusky-rose tint, softer than burgundy.",
  },
] as const;

/** The value-union of the 9 tints. `DARK_TINT_META` is the ordering authority. */
export type DarkTint = (typeof DARK_TINT_META)[number]["value"];

export const DEFAULT_DARK_TINT: DarkTint = "ink";

/** All tint values, in catalogue order. */
export const DARK_TINT_VALUES = DARK_TINT_META.map((t) => t.value) as readonly DarkTint[];

/**
 * Web preview swatches (OKLCH) keyed by tint value. Mirrors the swatch triples
 * historically inlined in `apps/web/src/lib/theme-preferences.ts`.
 */
export const DARK_TINT_SWATCHES_OKLCH = {
  ink: ["oklch(0.14 0.005 40)", "oklch(0.252 0.006 45)", "oklch(0.377 0.14 27)"],
  burgundy: ["oklch(0.13 0.025 25)", "oklch(0.205 0.034 25)", "oklch(0.52 0.16 28)"],
  midnight: ["oklch(0.14 0.021 255)", "oklch(0.215 0.025 255)", "oklch(0.58 0.13 252)"],
  canopy: ["oklch(0.135 0.02 155)", "oklch(0.215 0.026 155)", "oklch(0.56 0.12 158)"],
  slate: ["oklch(0.145 0.008 250)", "oklch(0.235 0.011 250)", "oklch(0.6 0.04 250)"],
  ocean: ["oklch(0.14 0.028 215)", "oklch(0.215 0.033 215)", "oklch(0.62 0.11 215)"],
  plum: ["oklch(0.145 0.03 320)", "oklch(0.22 0.038 320)", "oklch(0.6 0.15 320)"],
  espresso: ["oklch(0.15 0.02 60)", "oklch(0.225 0.026 60)", "oklch(0.62 0.1 65)"],
  rose: ["oklch(0.145 0.022 10)", "oklch(0.22 0.028 10)", "oklch(0.62 0.13 12)"],
} as const satisfies Record<DarkTint, readonly [string, string, string]>;

/**
 * Mobile preview swatches (sRGB hex) keyed by tint value — the sRGB equivalents
 * of the OKLCH swatches above. Mirrors the swatches historically inlined in
 * `apps/mobile/src/lib/theme-preferences.ts`.
 */
export const DARK_TINT_SWATCHES_HEX = {
  ink: ["#0B0808", "#252120", "#7B1113"],
  burgundy: ["#100404", "#25110F", "#B33830"],
  midnight: ["#040912", "#121A25", "#397DC4"],
  canopy: ["#030A05", "#0F1D14", "#1F8959"],
  slate: ["#080A0D", "#1A1F23", "#6E8398"],
  ocean: ["#000C10", "#041D23", "#0096AF"],
  plum: ["#100612", "#221526", "#A75FB7"],
  espresso: ["#110904", "#25190F", "#AF7940"],
  rose: ["#120708", "#261518", "#C76171"],
} as const satisfies Record<DarkTint, readonly [string, string, string]>;
