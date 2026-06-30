/**
 * Shared design tokens (colour, spacing, radius, typography) for the AURA mobile
 * app. These VALUES mirror the single source of truth in `/packages/ui`
 * (BRAND.md + `tokens.css` / `globals.css`).
 *
 * The web expresses colour in OKLCH and switches light / dark / dark-tint via
 * CSS custom properties (`.dark[data-dark-tint="…"]`). React Native / NativeWind
 * cannot evaluate `oklch()` or `color-mix()` natively, so the equivalent values
 * are resolved to sRGB hex here and exposed as named palettes. The active
 * palette is injected at runtime as CSS variables by `theme-context.tsx`, so the
 * semantic Tailwind classes (`bg-background`, `text-foreground`, `border-border`,
 * …) become theme-aware without per-screen changes.
 *
 * The brand maroon anchors are sourced from the framework-neutral `@cbs/tokens`
 * package (the single source of truth shared with the web); the per-tint
 * resolved sRGB palettes below stay local because React Native / NativeWind
 * cannot evaluate the web's `oklch()` / `color-mix()` expressions.
 */
import { brand } from '@cbs/tokens';

/* ── Brand maroon anchors (re-exported from @cbs/tokens) ─────────────────── */
export { brand };

/**
 * Semantic colour roles. Every theme (light + each dark tint) supplies the same
 * keys, so consumers never branch on the active theme. Mirrors the shadcn
 * variable contract bound in the web's `globals.css`.
 */
export interface SemanticColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  danger: string;
  dangerForeground: string;
  success: string;
  warning: string;
}

/* ── Light theme (mirrors `:root` in globals.css) ───────────────────────── */
const light: SemanticColors = {
  background: '#FBFBF9', // paper-50
  foreground: '#23201F', // ink-950
  card: '#FFFFFF',
  cardForeground: '#23201F',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#EEEDEA', // paper-200
  secondaryForeground: '#2A2725', // ink-900
  muted: '#EEEDEA',
  mutedForeground: '#6B6B6B', // paper-600
  accent: brand.maroonTint,
  accentForeground: '#2F2C2A', // ink-800
  border: '#E6E3DF', // paper-300
  input: '#E6E3DF',
  ring: brand.maroon,
  danger: '#B42318',
  dangerForeground: '#FFFFFF',
  success: '#1E7D52',
  warning: '#B5740B',
};

/* ── Dark tints (mirror `.dark[data-dark-tint="…"]` in globals.css) ─────── */
const darkInk: SemanticColors = {
  background: '#0B0808',
  foreground: '#F2F1EE',
  card: '#252120',
  cardForeground: '#F2F1EE',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#2B2826',
  secondaryForeground: '#F2F1EE',
  muted: '#2B2826',
  mutedForeground: '#928E8B',
  accent: '#3F281F',
  accentForeground: '#F2F1EE',
  border: '#403C3A',
  input: '#454140',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkBurgundy: SemanticColors = {
  background: '#100404',
  foreground: '#FAF1EF',
  card: '#25110F',
  cardForeground: '#FAF1EF',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#301B1A',
  secondaryForeground: '#FAF1EF',
  muted: '#301B1A',
  mutedForeground: '#BEABA5',
  accent: '#421C18',
  accentForeground: '#FAF1EF',
  border: '#4D3735',
  input: '#563E3C',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkMidnight: SemanticColors = {
  background: '#040912',
  foreground: '#EEF2F7',
  card: '#121A25',
  cardForeground: '#EEF2F7',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#1D2734',
  secondaryForeground: '#EEF2F7',
  muted: '#1D2734',
  mutedForeground: '#A7B2C1',
  accent: '#172C46',
  accentForeground: '#EEF2F7',
  border: '#3B434E',
  input: '#404A56',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkCanopy: SemanticColors = {
  background: '#030A05',
  foreground: '#EEF4EE',
  card: '#0F1D14',
  cardForeground: '#EEF4EE',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#192A1F',
  secondaryForeground: '#EEF4EE',
  muted: '#192A1F',
  mutedForeground: '#A6B6A9',
  accent: '#11331F',
  accentForeground: '#EEF4EE',
  border: '#35443A',
  input: '#3B4B40',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkSlate: SemanticColors = {
  background: '#080A0D',
  foreground: '#EFF2F6',
  card: '#181C20',
  cardForeground: '#EFF2F6',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#23282D',
  secondaryForeground: '#EFF2F6',
  muted: '#23282D',
  mutedForeground: '#ACB2B9',
  accent: '#222F3C',
  accentForeground: '#F1F6FA',
  border: '#3E4348',
  input: '#454A4F',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkOcean: SemanticColors = {
  background: '#000C10',
  foreground: '#EBF4F5',
  card: '#041C21',
  cardForeground: '#EBF4F5',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#0E2A30',
  secondaryForeground: '#EBF4F5',
  muted: '#0E2A30',
  mutedForeground: '#9CB7BC',
  accent: '#003540',
  accentForeground: '#ECF8FA',
  border: '#2E454B',
  input: '#334C53',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkPlum: SemanticColors = {
  background: '#100612',
  foreground: '#F6EFF7',
  card: '#221525',
  cardForeground: '#F6EFF7',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#2F2033',
  secondaryForeground: '#F6EFF7',
  muted: '#2F2033',
  mutedForeground: '#BAABBD',
  accent: '#402346',
  accentForeground: '#F9F2FB',
  border: '#4B3C4E',
  input: '#524356',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkEspresso: SemanticColors = {
  background: '#110904',
  foreground: '#F7F1E9',
  card: '#241910',
  cardForeground: '#F7F1E9',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#32251A',
  secondaryForeground: '#F7F1E9',
  muted: '#32251A',
  mutedForeground: '#BDAEA1',
  accent: '#442D15',
  accentForeground: '#FBF4EB',
  border: '#4E4136',
  input: '#56473C',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

const darkRose: SemanticColors = {
  background: '#120708',
  foreground: '#FAF1F1',
  card: '#261518',
  cardForeground: '#FAF1F1',
  primary: brand.maroon,
  primaryForeground: '#FBFBF9',
  secondary: '#332023',
  secondaryForeground: '#FAF1F1',
  muted: '#332023',
  mutedForeground: '#C1ABAC',
  accent: '#4A2228',
  accentForeground: '#FDF2F2',
  border: '#513C3F',
  input: '#594245',
  ring: brand.maroonTint,
  danger: '#E14B39',
  dangerForeground: '#FBFBF9',
  success: '#3FB07E',
  warning: '#D69A3F',
};

export const darkThemes = {
  ink: darkInk,
  burgundy: darkBurgundy,
  midnight: darkMidnight,
  canopy: darkCanopy,
  slate: darkSlate,
  ocean: darkOcean,
  plum: darkPlum,
  espresso: darkEspresso,
  rose: darkRose,
} as const;

export type DarkTint = keyof typeof darkThemes;

export const themes = {
  light,
  ...darkThemes,
} as const;

/**
 * Resolve the active semantic palette for a mode + tint pair. Light mode ignores
 * the tint (the tint only recolours the dark screen, matching the web).
 */
export function resolveColors(
  mode: 'light' | 'dark',
  tint: DarkTint,
): SemanticColors {
  return mode === 'dark' ? darkThemes[tint] : light;
}

/* ── Static (theme-agnostic) tokens ─────────────────────────────────────── */

export const tokens = {
  colors: {
    // Brand / primary — Ashesi maroon, used for primary actions and active nav.
    primary: {
      DEFAULT: brand.maroon,
      foreground: '#ffffff',
      muted: brand.maroonTint,
    },
    // Static fallbacks for the semantic surface roles. The theme-aware versions
    // are bound to runtime CSS variables in `tailwind.config.js` (see `semantic`)
    // and overridden there; these values keep the JS `palette`/`tokens` exports
    // self-describing for non-class consumers.
    background: light.background,
    surface: light.card,
    border: light.border,
    foreground: light.foreground,
    muted: light.mutedForeground,
    card: light.card,
    secondary: light.secondary,
    accent: light.accent,
    // Booking status colour-coding (Section 7.7 / 10.3).
    status: {
      pending: '#B5740B',
      approved: '#1E7D52',
      rejected: '#B42318',
      cancelled: '#6B6B6B',
      expired: '#4F4A47',
    },
    // Calendar block sources (Section 7.7).
    source: {
      lecture: '#7c3aed', // violet-600
      booking: '#7B1113',
      maintenance: '#ea580c', // orange-600
      available: '#1E7D52',
    },
    danger: {
      DEFAULT: '#B42318',
      foreground: '#ffffff',
    },
    success: {
      DEFAULT: '#1E7D52',
      foreground: '#ffffff',
    },
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  spacing: {
    // Extends the default Tailwind scale with a couple of layout helpers.
    18: '72px',
    22: '88px',
  },
  fontSize: {
    // [size, lineHeight]
    xs: ['12px', '16px'],
    sm: ['14px', '20px'],
    base: ['16px', '24px'],
    lg: ['18px', '26px'],
    xl: ['22px', '30px'],
    '2xl': ['28px', '36px'],
  },
} as const;

export type Tokens = typeof tokens;

/**
 * A small subset of token values surfaced as plain hex strings for places that
 * cannot use Tailwind classes (status bar tint, navigation tint, Reanimated
 * inline styles). For theme-aware tints prefer `useThemeColors()` from
 * `theme-context.tsx`; `palette` stays as static brand fallbacks.
 */
export const palette = {
  primary: brand.maroon,
  foreground: light.foreground,
  muted: light.mutedForeground,
  border: light.border,
  background: light.background,
  surface: light.card,
  danger: tokens.colors.danger.DEFAULT,
  status: tokens.colors.status,
  source: tokens.colors.source,
} as const;
