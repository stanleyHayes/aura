/**
 * Token storage backed by `expo-secure-store` (Section 9.1 / 13 — "bearer
 * access/refresh in secure store"). On native, tokens never touch AsyncStorage
 * or any unencrypted store. Web previews use a non-persistent in-memory fallback
 * because `expo-secure-store` is native-only there.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

const webStore = new Map<string, string>();

async function setStoredItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

async function getStoredItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStore.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key, OPTIONS);
}

async function deleteStoredItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key, OPTIONS);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  const accessExpiresAt =
    tokens.expires_in != null ? Date.now() + tokens.expires_in * 1000 : undefined;

  await Promise.all([
    setStoredItem(ACCESS_KEY, tokens.access_token),
    setStoredItem(REFRESH_KEY, tokens.refresh_token),
    accessExpiresAt != null
      ? setStoredItem(ACCESS_EXP_KEY, String(accessExpiresAt))
      : deleteStoredItem(ACCESS_EXP_KEY),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return getStoredItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getStoredItem(REFRESH_KEY);
}

export async function getAccessExpiry(): Promise<number | null> {
  const raw = await getStoredItem(ACCESS_EXP_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    deleteStoredItem(ACCESS_KEY),
    deleteStoredItem(REFRESH_KEY),
    deleteStoredItem(ACCESS_EXP_KEY),
  ]);
}

export async function hasSession(): Promise<boolean> {
  return (await getRefreshToken()) != null;
}
