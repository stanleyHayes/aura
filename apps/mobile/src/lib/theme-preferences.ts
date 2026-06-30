/**
 * Theme preferences (mode + dark tint) for AURA mobile.
 *
 * Mirrors the web's `apps/web/src/lib/theme-preferences.ts` API and option set
 * so the two surfaces stay in lock-step. Like the web (localStorage), and like
 * the existing biometric toggle, these are non-sensitive UI preferences and are
 * persisted in AsyncStorage — NOT SecureStore, which is reserved for auth
 * tokens (`src/lib/secure-store.ts`).
 *
 * The chosen mode + tint are read on launch and applied by
 * `src/theme/theme-context.tsx`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DARK_TINT_META,
  DARK_TINT_SWATCHES_HEX,
  DEFAULT_DARK_TINT,
} from '@cbs/tokens';

import type { DarkTint } from '@/theme/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_STORAGE_KEY = 'aura.theme_mode';
export const DARK_TINT_STORAGE_KEY = 'aura.dark_tint';

/**
 * Dark-tint catalogue — shared `value`/`label`/`description` metadata + ordering
 * from `@cbs/tokens`, paired with the mobile sRGB hex preview swatches (the
 * equivalents of the web's OKLCH swatches; see `src/theme/tokens.ts`). Shape and
 * ordering are identical to the previous hand-written constant.
 */
export const DARK_TINT_OPTIONS = DARK_TINT_META.map((tint) => ({
  value: tint.value,
  label: tint.label,
  description: tint.description,
  swatches: DARK_TINT_SWATCHES_HEX[tint.value],
})) as readonly {
  value: DarkTint;
  label: string;
  description: string;
  swatches: readonly string[];
}[];

export const DEFAULT_THEME_MODE: ThemeMode = 'system';
export { DEFAULT_DARK_TINT };

const tintValues = new Set<string>(DARK_TINT_OPTIONS.map((o) => o.value));
const modeValues = new Set<ThemeMode>(['light', 'dark', 'system']);

export function normaliseThemeMode(value: unknown): ThemeMode {
  return typeof value === 'string' && modeValues.has(value as ThemeMode)
    ? (value as ThemeMode)
    : DEFAULT_THEME_MODE;
}

export function normaliseDarkTint(value: unknown): DarkTint {
  return typeof value === 'string' && tintValues.has(value)
    ? (value as DarkTint)
    : DEFAULT_DARK_TINT;
}

export async function readSavedThemeMode(): Promise<ThemeMode> {
  return normaliseThemeMode(await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY));
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}

export async function readSavedDarkTint(): Promise<DarkTint> {
  return normaliseDarkTint(await AsyncStorage.getItem(DARK_TINT_STORAGE_KEY));
}

export async function saveDarkTint(tint: DarkTint): Promise<void> {
  await AsyncStorage.setItem(DARK_TINT_STORAGE_KEY, tint);
}
