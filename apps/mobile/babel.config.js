/**
 * Babel config for the CBS Expo app.
 * - `babel-preset-expo` with the NativeWind JSX import source so `className`
 *   props are transformed.
 * - `nativewind/babel` preset wires up Tailwind class processing.
 * - `react-native-worklets/plugin` MUST be listed last (Reanimated 4 requirement).
 */
module.exports = function babel(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
