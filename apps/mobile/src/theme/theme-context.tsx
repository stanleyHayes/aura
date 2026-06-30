/**
 * Theme provider + hooks for AURA mobile.
 *
 * Parity with the web (`apps/web`): light / dark mode plus a selectable dark
 * "tint" (ink, burgundy, midnight, canopy, slate, ocean, plum, espresso, rose).
 * The chosen mode + tint are persisted (AsyncStorage via
 * `src/lib/theme-preferences.ts`) and re-applied on launch.
 *
 * How it applies:
 *  - The active semantic palette is injected as CSS custom properties through
 *    NativeWind's `vars()` on a wrapping <View>, so the semantic Tailwind
 *    classes (`bg-background`, `text-foreground`, `border-border`, …) recolour
 *    automatically — the same single-source-of-truth model the web uses with
 *    `.dark[data-dark-tint="…"]`.
 *  - `colorScheme.set()` keeps NativeWind's own light/dark variant in sync (so
 *    any `dark:` utilities and RN's appearance APIs follow the chosen mode).
 *  - `useThemeColors()` exposes the resolved palette for the few places that
 *    cannot use classes (status bar, navigation tint, Reanimated inline styles).
 */
import { colorScheme, vars } from 'nativewind';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme, View } from 'react-native';

import {
  DEFAULT_DARK_TINT,
  DEFAULT_THEME_MODE,
  normaliseDarkTint,
  normaliseThemeMode,
  readSavedDarkTint,
  readSavedThemeMode,
  saveDarkTint as persistDarkTint,
  saveThemeMode as persistThemeMode,
  type ThemeMode,
} from '@/lib/theme-preferences';
import {
  resolveColors,
  type DarkTint,
  type SemanticColors,
} from '@/theme/tokens';

interface ThemeContextValue {
  /** The user's chosen mode (light / dark / system). */
  mode: ThemeMode;
  /** The user's chosen dark tint (applies only when the resolved scheme is dark). */
  tint: DarkTint;
  /** The scheme actually in effect after resolving "system". */
  scheme: 'light' | 'dark';
  /** The resolved semantic palette for the active scheme + tint. */
  colors: SemanticColors;
  /** True until persisted preferences have been read on launch. */
  loading: boolean;
  setMode: (mode: ThemeMode) => void;
  setTint: (tint: DarkTint) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Build the `vars()` style object from a resolved palette. Keys MUST match the
 *  `--color-*` variables referenced in `tailwind.config.js`. */
function paletteToVars(colors: SemanticColors): Record<`--${string}`, string> {
  return {
    '--color-background': colors.background,
    '--color-foreground': colors.foreground,
    '--color-card': colors.card,
    '--color-card-foreground': colors.cardForeground,
    '--color-primary': colors.primary,
    '--color-primary-foreground': colors.primaryForeground,
    '--color-secondary': colors.secondary,
    '--color-secondary-foreground': colors.secondaryForeground,
    '--color-muted': colors.muted,
    '--color-muted-foreground': colors.mutedForeground,
    '--color-accent': colors.accent,
    '--color-accent-foreground': colors.accentForeground,
    '--color-border': colors.border,
    '--color-input': colors.input,
    '--color-ring': colors.ring,
    '--color-danger': colors.danger,
    '--color-danger-foreground': colors.dangerForeground,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [tint, setTintState] = useState<DarkTint>(DEFAULT_DARK_TINT);
  const [loading, setLoading] = useState(true);

  // Load persisted preferences on launch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedMode, savedTint] = await Promise.all([
        readSavedThemeMode(),
        readSavedDarkTint(),
      ]);
      if (cancelled) return;
      setModeState(normaliseThemeMode(savedMode));
      setTintState(normaliseDarkTint(savedTint));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  // Keep NativeWind's own light/dark variant in sync with the chosen mode.
  useEffect(() => {
    colorScheme.set(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void persistThemeMode(next);
  }, []);

  const setTint = useCallback((next: DarkTint) => {
    setTintState(next);
    void persistDarkTint(next);
  }, []);

  const colors = useMemo(() => resolveColors(scheme, tint), [scheme, tint]);
  const themeVars = useMemo(() => vars(paletteToVars(colors)), [colors]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, tint, scheme, colors, loading, setMode, setTint }),
    [mode, tint, scheme, colors, loading, setMode, setTint],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View
        style={[{ flex: 1, backgroundColor: colors.background }, themeVars]}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

/** Convenience hook for the resolved semantic palette (non-class consumers). */
export function useThemeColors(): SemanticColors {
  return useTheme().colors;
}
