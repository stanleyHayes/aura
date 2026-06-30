/**
 * Settings (Section 13 — biometric unlock toggle, account, sign out). Shared by
 * both tab groups.
 */
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';

import { getApiBaseUrl } from '@/api/client';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { ThemeSettings } from '@/features/theme-settings';
import {
  getBiometricPref,
  isBiometricHardwareAvailable,
  setBiometricPref,
} from '@/lib/biometrics';
import { palette } from '@/theme/tokens';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System administrator',
  TIMETABLE_ADMIN: 'Timetable administrator',
  BOOKING_OFFICER: 'Booking officer',
  REQUESTER: 'Requester',
};

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loadingPref, setLoadingPref] = useState(true);

  useEffect(() => {
    void (async () => {
      const [available, enabled] = await Promise.all([
        isBiometricHardwareAvailable(),
        getBiometricPref(),
      ]);
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      setLoadingPref(false);
    })();
  }, []);

  async function toggleBiometric(next: boolean) {
    if (next && !biometricAvailable) {
      Alert.alert(
        'Biometrics unavailable',
        'Set up Face ID / Touch ID or a fingerprint on your device first.',
      );
      return;
    }
    setBiometricEnabled(next);
    await setBiometricPref(next);
  }

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4"
    >
      <Card className="gap-1">
        <Text className="text-xs font-medium uppercase text-muted">Account</Text>
        <Text className="text-lg font-semibold text-foreground">
          {user?.fullName ?? '—'}
        </Text>
        <Text className="text-sm text-muted">{user?.email}</Text>
        {user?.role ? (
          <Text className="text-sm text-primary">
            {ROLE_LABELS[user.role] ?? user.role}
          </Text>
        ) : null}
      </Card>

      <Card className="gap-3">
        <Text className="text-xs font-medium uppercase text-muted">Security</Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base text-foreground">Biometric unlock</Text>
            <Text className="text-sm text-muted">
              Require Face ID / Touch ID when reopening the app.
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            disabled={loadingPref}
            onValueChange={(v) => void toggleBiometric(v)}
            trackColor={{ true: palette.primary }}
          />
        </View>
        {!biometricAvailable && !loadingPref ? (
          <Text className="text-xs text-muted">
            No biometrics enrolled on this device.
          </Text>
        ) : null}
      </Card>

      <ThemeSettings />

      <Card className="gap-1">
        <Text className="text-xs font-medium uppercase text-muted">About</Text>
        <Text className="text-sm text-muted">
          Version {Constants.expoConfig?.version ?? '0.1.0'}
        </Text>
        <Text className="text-xs text-muted">API: {getApiBaseUrl()}</Text>
      </Card>

      <Button label="Sign out" variant="danger" onPress={confirmLogout} />
    </ScrollView>
  );
}
