/**
 * Metro config for the AURA Expo app.
 *
 * NativeWind v5: `withNativeWind(config)` takes no `input` argument — any `.css`
 * imported by the app (here `app/_layout.tsx` imports `global.css`) is compiled
 * through PostCSS/Tailwind v4 and turned into native styles. This removes the
 * v4 monorepo workaround that pinned an absolute `input`/`configPath`.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config);
