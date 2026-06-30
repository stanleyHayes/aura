/**
 * Babel config for the AURA Expo app.
 *
 * NativeWind v5 no longer needs any Babel preset — its transform is applied
 * automatically by the Metro config (`withNativeWind`). So this drops the v4
 * `jsxImportSource: 'nativewind'` option and the `nativewind/babel` preset.
 *
 * `react-native-worklets/plugin` MUST remain last (Reanimated 4 requirement).
 */
module.exports = function babel(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
