import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config for the Classroom Booking System mobile app.
 *
 * Channels (Section 13 — "EAS Update for OTA … staging and production
 * channels"): the active EAS Update channel is selected by the build profile
 * in `eas.json` (see README). `EXPO_PUBLIC_API_BASE_URL` selects the API root;
 * it defaults to the local Go API (`http://localhost:8080/api/v1`).
 *
 * Deep links (Section 13 — "Deep links open the relevant booking"): the app
 * owns the `cbs://` scheme and the `https://app.cbs.example.edu` universal /
 * app links. `cbs://booking/<id>` and the matching https path both resolve to
 * the `app/booking/[id].tsx` route via expo-router's linking integration.
 */

const APP_VARIANT = process.env.APP_VARIANT ?? 'production'; // 'development' | 'staging' | 'production'
const IS_DEV = APP_VARIANT === 'development';
const IS_STAGING = APP_VARIANT === 'staging';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1';

// EAS project id — replace with the real id from `eas init` (left as an env so
// CI can inject it without committing the value).
const EAS_PROJECT_ID =
  process.env.EAS_PROJECT_ID ?? '00000000-0000-0000-0000-000000000000';

function name(): string {
  if (IS_DEV) return 'CBS (Dev)';
  if (IS_STAGING) return 'CBS (Staging)';
  return 'Classroom Booking';
}

function bundleId(): string {
  if (IS_DEV) return 'edu.example.cbs.dev';
  if (IS_STAGING) return 'edu.example.cbs.staging';
  return 'edu.example.cbs';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: name(),
  slug: 'cbs-mobile',
  scheme: 'cbs',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // New Architecture is the default in Expo SDK 56; no flag needed.
  icon: './assets/icon.png',
  // Splash is configured via the expo-splash-screen plugin in SDK 56 (see plugins).
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: bundleId(),
    supportsTablet: true,
    // Universal links — open https://app.cbs.example.edu/booking/<id> in-app.
    associatedDomains: ['applinks:app.cbs.example.edu'],
    infoPlist: {
      // Push delivery + background fetch for notification re-sync.
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleId(),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    // App Links — verified https deep links into bookings.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'app.cbs.example.edu', pathPrefix: '/booking' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
    'expo-secure-store',
    'expo-local-authentication',
    [
      'expo-notifications',
      {
        // Push icon/colour for Android notification tray.
        color: '#1d4ed8',
      },
    ],
    [
      'expo-camera',
      {
        // QR check-in is Phase 2 (Section 4.3 / 13); permission declared now so
        // the OTA-updatable JS can light it up without a new native build.
        cameraPermission:
          'Allow CBS to use the camera for QR-code room check-in (Phase 2).',
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission:
          'Allow CBS to add your approved room bookings to your device calendar.',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'cbs',
        project: process.env.SENTRY_PROJECT ?? 'mobile',
        // Auth token injected by EAS secrets at build time, never committed.
      },
    ],
  ],
  // OTA updates (EAS Update). The channel is resolved per build profile in
  // eas.json; runtimeVersion uses the native fingerprint so OTA only lands on
  // compatible binaries.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'fingerprint',
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
    appVariant: APP_VARIANT,
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
  experiments: {
    typedRoutes: true,
  },
});
