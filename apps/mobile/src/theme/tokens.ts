/**
 * Shared design tokens (colour, spacing, radius, typography) for the CBS mobile
 * app. These VALUES mirror the single source of truth in `/packages/ui`
 * (Section 10.2 — "Tokens live in one package and are shared with mobile").
 *
 * TODO(packages): consume `@cbs/ui/tokens` directly once the shared package is
 * published into the workspace; this local copy keeps `apps/mobile`
 * self-contained for now.
 */

export const tokens = {
  colors: {
    // Brand / primary — used for primary actions and active nav.
    primary: {
      DEFAULT: '#1d4ed8',
      foreground: '#ffffff',
      muted: '#dbeafe',
    },
    // Neutral surfaces & text.
    background: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    foreground: '#0f172a',
    muted: '#64748b',
    // Booking status colour-coding (Section 7.7 / 10.3).
    status: {
      pending: '#b45309', // amber-700
      approved: '#15803d', // green-700
      rejected: '#b91c1c', // red-700
      cancelled: '#64748b', // slate-500
      expired: '#475569', // slate-600
    },
    // Calendar block sources (Section 7.7).
    source: {
      lecture: '#7c3aed', // violet-600
      booking: '#1d4ed8', // blue-700
      maintenance: '#ea580c', // orange-600
      available: '#15803d', // green-700
    },
    danger: {
      DEFAULT: '#b91c1c',
      foreground: '#ffffff',
    },
    success: {
      DEFAULT: '#15803d',
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
 * cannot use Tailwind classes (e.g. status bar tint, navigation tint colours,
 * Reanimated-driven inline styles).
 */
export const palette = {
  primary: tokens.colors.primary.DEFAULT,
  foreground: tokens.colors.foreground,
  muted: tokens.colors.muted,
  border: tokens.colors.border,
  background: tokens.colors.background,
  surface: tokens.colors.surface,
  danger: tokens.colors.danger.DEFAULT,
  status: tokens.colors.status,
  source: tokens.colors.source,
} as const;
