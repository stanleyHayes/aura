import {
  DARK_TINT_META,
  DARK_TINT_SWATCHES_OKLCH,
  DEFAULT_DARK_TINT,
  type DarkTint,
} from "@cbs/tokens";

// Re-export the shared catalogue types/constants so this module's public
// surface is unchanged for existing consumers.
export { DEFAULT_DARK_TINT };
export type { DarkTint };

export const THEME_STORAGE_KEY = "aura-theme";
export const DARK_TINT_STORAGE_KEY = "aura-dark-tint";

/**
 * Web dark-tint catalogue — shared `value` / `label` / `description` metadata
 * from `@cbs/tokens`, paired with the web's OKLCH preview swatches. Shape and
 * ordering are identical to the previous hand-written constant.
 */
export const DARK_TINT_OPTIONS = DARK_TINT_META.map((tint) => ({
  value: tint.value,
  label: tint.label,
  description: tint.description,
  swatches: DARK_TINT_SWATCHES_OKLCH[tint.value],
})) as readonly {
  value: DarkTint;
  label: string;
  description: string;
  swatches: readonly [string, string, string];
}[];

export type ThemeMode = "light" | "dark";

const tintValues = new Set<string>(
  DARK_TINT_OPTIONS.map((option) => option.value),
);

function prefersDarkTheme() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function readSavedThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return prefersDarkTheme() ? "dark" : "light";
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const isDark = mode === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = mode;
}

export function normaliseDarkTint(value: unknown): DarkTint {
  return typeof value === "string" && tintValues.has(value)
    ? (value as DarkTint)
    : DEFAULT_DARK_TINT;
}

export function readSavedDarkTint(): DarkTint {
  if (typeof window === "undefined") return DEFAULT_DARK_TINT;
  return normaliseDarkTint(window.localStorage.getItem(DARK_TINT_STORAGE_KEY));
}

export function applyDarkTint(tint: DarkTint) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.darkTint = tint;
}

export function saveDarkTint(tint: DarkTint) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DARK_TINT_STORAGE_KEY, tint);
  applyDarkTint(tint);
  window.dispatchEvent(new Event("aura-dark-tint-change"));
}
