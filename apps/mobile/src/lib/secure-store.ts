/**
 * Token storage backed by `expo-secure-store` (Section 9.1 / 13 — "bearer
 * access/refresh in secure store"). Tokens never touch AsyncStorage or any
 * unencrypted store.
 */
import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from '@/schemas';

const ACCESS_KEY = 'cbs.access_token';
const REFRESH_KEY = 'cbs.refresh_token';
const ACCESS_EXP_KEY = 'cbs.access_expires_at'; // epoch ms

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Available after first unlock; required so background push handlers can read
  // the token to re-sync. Adjust to WHEN_UNLOCKED if stricter is desired.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type StoredTokens = AuthTokens & { accessExpiresAt?: number };

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  const accessExpiresAt =
    tokens.expiresIn != null ? Date.now() + tokens.expiresIn * 1000 : undefined;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken, OPTIONS),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, OPTIONS),
    accessExpiresAt != null
      ? SecureStore.setItemAsync(ACCESS_EXP_KEY, String(accessExpiresAt), OPTIONS)
      : SecureStore.deleteItemAsync(ACCESS_EXP_KEY),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY, OPTIONS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY, OPTIONS);
}

export async function getAccessExpiry(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(ACCESS_EXP_KEY, OPTIONS);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY, OPTIONS),
    SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS),
    SecureStore.deleteItemAsync(ACCESS_EXP_KEY, OPTIONS),
  ]);
}

export async function hasSession(): Promise<boolean> {
  return (await getRefreshToken()) != null;
}
