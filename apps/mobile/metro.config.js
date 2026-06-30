/**
 * Metro config for the CBS Expo app.
 * Wraps the default Expo config with NativeWind's transformer so that the
 * Tailwind `global.css` is processed and `className` styling works on native.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);
const appRoot = __dirname;

module.exports = withNativeWind(config, {
  input: path.join(appRoot, 'global.css'),
  configPath: path.join(appRoot, 'tailwind.config.js'),
  disableTypeScriptGeneration: true,
});
