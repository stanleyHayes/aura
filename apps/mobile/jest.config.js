/**
 * Jest config using `jest-expo` (Section 22.3). Tests are not part of the
 * scaffold deliverable but the harness is wired so `pnpm test` works once
 * specs are added under `__tests__/`.
 */
module.exports = {
  preset: 'jest-expo',
  // @testing-library/react-native v12.4+ auto-extends Jest matchers; the old
  // `/extend-expect` entry point was removed, so no setup file is needed.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|nativewind|react-native-css-interop|@sentry/.*)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
