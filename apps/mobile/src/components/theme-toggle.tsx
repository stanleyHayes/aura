/**
 * Quick light/dark toggle for the navigation headers (mirrors the web's
 * `apps/web/src/components/theme-toggle.tsx`). A single sun/moon button that
 * flips the active scheme through the theme context.
 *
 * The theme context exposes `mode` (light | dark | system) plus the resolved
 * `scheme`. Tapping the toggle resolves the *opposite* of whatever is currently
 * on screen and pins it explicitly (so "system" becomes a concrete light/dark
 * choice), matching the web's binary toggle behaviour.
 *
 * Also exports `withAlpha`, a tiny colour helper used by a few non-class
 * consumers (e.g. the login error surface) to derive a translucent tint from a
 * solid theme colour — kept here to avoid touching the shared `tokens.ts`.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/theme-context';

/**
 * Derive an `#RRGGBBAA` colour from a 6-digit hex + an opacity in [0, 1].
 * Falls back to the input untouched for non-6-digit-hex values so it is safe to
 * call with any theme colour string.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const clamped = Math.max(0, Math.min(1, alpha));
  const a = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/** Header button that flips the active light/dark scheme. */
export function ThemeToggle() {
  const { scheme, setMode, colors } = useTheme();
  const isDark = scheme === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isDark ? 'Switch to light theme' : 'Switch to dark theme'
      }
      accessibilityState={{ selected: isDark }}
      hitSlop={8}
      onPress={() => setMode(isDark ? 'light' : 'dark')}
      className="mr-3 size-9 items-center justify-center rounded-full active:opacity-70"
      style={{ backgroundColor: colors.muted }}
    >
      <Ionicons
        name={isDark ? 'sunny-outline' : 'moon-outline'}
        size={18}
        color={colors.foreground}
      />
    </Pressable>
  );
}
