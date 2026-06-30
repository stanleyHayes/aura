/**
 * PostCSS config required by NativeWind v5 — Tailwind v4 runs as a PostCSS
 * plugin to compile `global.css`, which NativeWind's Metro transformer then
 * turns into native styles.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
