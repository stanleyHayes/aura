/**
 * Biometric (Face ID / Touch ID / fingerprint) unlock via
 * `expo-local-authentication` (Section 13 — "biometric unlock optional").
 *
 * The toggle preference is stored in AsyncStorage (it is a non-sensitive UI
 * preference; the actual tokens stay in SecureStore). When enabled, the app
 * requires a successful local auth before revealing an existing session on cold
 * start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_PREF_KEY = 'cbs.biometric_unlock_enabled';

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function getBiometricPref(): Promise<boolean> {
  return (await AsyncStorage.getItem(BIOMETRIC_PREF_KEY)) === '1';
}

export async function setBiometricPref(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, enabled ? '1' : '0');
}

export async function authenticateBiometric(
  reason = 'Unlock Classroom Booking',
): Promise<boolean> {
  const available = await isBiometricHardwareAvailable();
  if (!available) return true; // No biometrics enrolled — do not lock the user out.
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  return result.success;
}
