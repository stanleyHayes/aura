/**
 * Tailwind v3 config for NativeWind v4.
 *
 * NativeWind reads `content` + `theme.extend` from this file. The token VALUES
 * below mirror the shared design tokens that live in `/packages/ui` for the web
 * app (BRAND.md). They are duplicated here intentionally to keep `apps/mobile`
 * self-contained.
 *
 * Theme-aware (light / dark / dark-tint) roles are expressed as CSS custom
 * properties so a single set of semantic classes (`bg-background`,
 * `text-foreground`, `border-border`, …) recolours at runtime. The active
 * palette is injected by `src/theme/theme-context.tsx` via NativeWind's `vars()`
 * (mirrors the web's `.dark[data-dark-tint="…"]` switching).
 *
 * TODO(packages): replace this inline token block with an import of the shared
 * `@aura/config/tailwind` preset once the monorepo workspace is wired up.
 */
const { tokens } = require('./src/theme/tokens');

/** Semantic colour roles bound to runtime CSS variables (with safe fallbacks). */
const semantic = {
  background: 'var(--color-background, #FBFBF9)',
  foreground: 'var(--color-foreground, #23201F)',
  card: 'var(--color-card, #FFFFFF)',
  'card-foreground': 'var(--color-card-foreground, #23201F)',
  surface: 'var(--color-card, #FFFFFF)',
  secondary: 'var(--color-secondary, #EEEDEA)',
  'secondary-foreground': 'var(--color-secondary-foreground, #2A2725)',
  // `muted` historically means "muted text" in this app (text-muted), so map it
  // to the foreground role; `muted-bg` exposes the muted surface when needed.
  muted: 'var(--color-muted-foreground, #6B6B6B)',
  'muted-bg': 'var(--color-muted, #EEEDEA)',
  'muted-foreground': 'var(--color-muted-foreground, #6B6B6B)',
  accent: 'var(--color-accent, #F3E1E1)',
  'accent-foreground': 'var(--color-accent-foreground, #2F2C2A)',
  border: 'var(--color-border, #E6E3DF)',
  input: 'var(--color-input, #E6E3DF)',
  ring: 'var(--color-ring, #7B1113)',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  // NativeWind v5 ships its RN preset as CSS (`@import "nativewind/theme"` in
  // global.css), so the old `presets: [require('nativewind/preset')]` is gone.
  theme: {
    extend: {
      colors: {
        ...tokens.colors,
        ...semantic,
        // Theme-aware primary: surface uses the runtime var; brand mark/anchors
        // stay fixed maroon via `tokens.colors.primary`.
        primary: {
          DEFAULT: 'var(--color-primary, #7B1113)',
          foreground: 'var(--color-primary-foreground, #ffffff)',
          muted: 'var(--color-accent, #F3E1E1)',
        },
        danger: {
          DEFAULT: 'var(--color-danger, #B42318)',
          foreground: 'var(--color-danger-foreground, #ffffff)',
        },
      },
      borderRadius: tokens.radius,
      spacing: tokens.spacing,
      fontSize: tokens.fontSize,
      // Outfit typeface (BRAND.md). The weighted families are loaded in
      // app/_layout.tsx via @expo-google-fonts/outfit + useFonts. `sans` is the
      // default face so existing text picks up Outfit automatically; the named
      // weight families let components opt into a heavier cut where the RN
      // `fontWeight` utilities don't map to a real bundled face.
      fontFamily: {
        sans: ['Outfit_400Regular'],
        medium: ['Outfit_500Medium'],
        semibold: ['Outfit_600SemiBold'],
        bold: ['Outfit_700Bold'],
      },
    },
  },
  plugins: [],
};
