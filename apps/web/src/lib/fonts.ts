import { Outfit } from "next/font/google";

/**
 * AURA body/UI + heading font: Outfit (BRAND.md §Typography). Wired as the
 * default sans so Tailwind `font-sans` (and the now-aliased `font-serif`)
 * resolve to Outfit. Loaded via next/font for CLS-safe loading (§12.4).
 */
export const fontSans = Outfit({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
});

/**
 * Headings also use Outfit (BRAND.md). Kept as a named export so existing
 * `fontSerif.variable` wiring continues to resolve to the same family.
 */
export const fontSerif = fontSans;
