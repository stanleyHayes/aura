/**
 * Sentry initialisation (Section 13 — `@sentry/react-native`). DSN is injected
 * via `EXPO_PUBLIC_SENTRY_DSN`; when absent (local dev), init is skipped.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment:
      (Constants.expoConfig?.extra as { appVariant?: string } | undefined)
        ?.appVariant ?? 'development',
    tracesSampleRate: 0.2,
    integrations: [navigationIntegration],
    // Do not send PII; scrub by default. Tokens never leave SecureStore.
    sendDefaultPii: false,
  });
}

export { Sentry };
