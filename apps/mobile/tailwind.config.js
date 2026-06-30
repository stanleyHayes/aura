/**
 * Tailwind v3 config for NativeWind v4.
 *
 * NativeWind reads `content` + `theme.extend` from this file. The token VALUES
 * below mirror the shared design tokens that live in `/packages/ui` for the web
 * app (Section 10.2). They are duplicated here intentionally to keep
 * `apps/mobile` self-contained.
 *
 * TODO(packages): replace this inline token block with an import of the shared
 * `@cbs/config/tailwind` preset once the monorepo workspace is wired up.
 */
const { tokens } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.radius,
      spacing: tokens.spacing,
      fontSize: tokens.fontSize,
    },
  },
  plugins: [],
};
