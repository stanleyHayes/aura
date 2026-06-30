import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config for AURA — Ashesi University Resource Allocation (mobile).
 *
 * Channels (Section 13 — "EAS Update for OTA … staging and production
 * channels"): the active EAS Update channel is selected by the build profile
 * in `eas.json` (see README). `EXPO_PUBLIC_API_BASE_URL` selects the API root:
 * development defaults to the local Go API, while staging/production must pass
 * an HTTPS deployed API URL.
 *
 * Deep links (Section 13 — "Deep links open the relevant booking"): the app
 * owns the `aura://` scheme and the `https://app.aura.ashesi.edu` universal /
 * app links. `aura://booking/<id>` and the matching https path both resolve to
 * the `app/booking/[id].tsx` route via expo-router's linking integration.
 */

type AppVariant = 'development' | 'staging' | 'production';

function appVariant(): AppVariant {
  const variant = process.env.APP_VARIANT ?? 'development';
  if (
    variant !== 'development' &&
    variant !== 'staging' &&
    variant !== 'production'
  ) {
    throw new Error(
      `APP_VARIANT must be development, staging or production; received "${variant}".`,
    );
  }
  return variant;
}

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required for this build profile.`);
  return value;
}

function assertRealEasProjectId(value: string): string {
  if (value === '00000000-0000-0000-0000-000000000000') {
    throw new Error('EAS_PROJECT_ID must be the real project id from `eas init`.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('EAS_PROJECT_ID must be a valid EAS project UUID.');
  }
  return value;
}

function assertRemoteApiUrl(value: string): string {
  if (!/^https:\/\//i.test(value)) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL must use HTTPS for staging/production builds.',
    );
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(value)) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL must point to the deployed API for staging/production builds.',
    );
  }
  return value;
}

const APP_VARIANT = appVariant();
const IS_DEV = APP_VARIANT === 'development';
const IS_STAGING = APP_VARIANT === 'staging';
const IS_RELEASE = IS_STAGING || APP_VARIANT === 'production';

const API_BASE_URL =
  IS_RELEASE
    ? assertRemoteApiUrl(
        requiredEnv(
          'EXPO_PUBLIC_API_BASE_URL',
          process.env.EXPO_PUBLIC_API_BASE_URL,
        ),
      )
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1');

// Ashesi maroon — see BRAND.md.
const ASHESI_MAROON = '#7B1113';

// EAS project id from `eas init`. Project ids are not secret and are safe to
// commit (Expo recommends it); the env override lets CI point at a different
// project without code changes.
const DEFAULT_EAS_PROJECT_ID = '65cdd520-1672-49b4-aef0-3f1418c94768';

const EAS_PROJECT_ID = IS_RELEASE
  ? assertRealEasProjectId(process.env.EAS_PROJECT_ID ?? DEFAULT_EAS_PROJECT_ID)
  : (process.env.EAS_PROJECT_ID ?? DEFAULT_EAS_PROJECT_ID);

function name(): string {
  if (IS_DEV) return 'AURA (Dev)';
  if (IS_STAGING) return 'AURA (Staging)';
  return 'AURA';
}

function bundleId(): string {
  if (IS_DEV) return 'edu.ashesi.aura.dev';
  if (IS_STAGING) return 'edu.ashesi.aura.staging';
  return 'edu.ashesi.aura';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: name(),
  slug: 'aura-mobile',
  // EAS account that owns the @vladislaus/aura-mobile project (from `eas init`).
  owner: 'vladislaus',
  scheme: 'aura',
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
    // Universal links — open https://app.aura.ashesi.edu/booking/<id> in-app.
    associatedDomains: ['applinks:app.aura.ashesi.edu'],
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
      backgroundColor: ASHESI_MAROON,
    },
    // App Links — verified https deep links into bookings.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'app.aura.ashesi.edu', pathPrefix: '/booking' }],
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
    '@sentry/react-native',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#fff8f8',
      },
    ],
    'expo-secure-store',
    'expo-local-authentication',
    [
      'expo-notifications',
      {
        // Push icon/colour for Android notification tray (Ashesi maroon).
        icon: './assets/notification-icon.png',
        color: ASHESI_MAROON,
      },
    ],
    [
      'expo-camera',
      {
        // QR check-in is Phase 2 (Section 4.3 / 13); permission declared now so
        // the OTA-updatable JS can light it up without a new native build.
        cameraPermission:
          'Allow AURA to use the camera for QR-code room check-in (Phase 2).',
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission:
          'Allow AURA to add your approved room bookings to your device calendar.',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'ashesi',
        project: process.env.SENTRY_PROJECT ?? 'aura-mobile',
        // Auth token injected by EAS secrets at build time, never committed.
      },
    ],
  ],
  // OTA updates (EAS Update). The channel is resolved per build profile in
  // eas.json; runtimeVersion uses the native fingerprint so OTA only lands on
  // compatible binaries.
  updates: EAS_PROJECT_ID
    ? {
        url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      }
    : undefined,
  runtimeVersion: {
    policy: 'fingerprint',
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
    appVariant: APP_VARIANT,
    eas: {
      projectId: EAS_PROJECT_ID ?? '',
    },
  },
  experiments: {
    typedRoutes: true,
  },
});
