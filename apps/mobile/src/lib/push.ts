/**
 * Expo push notification registration (Section 13 — "register the Expo push
 * token via POST /api/v1/devices"). Deep links from a tapped notification open
 * the relevant booking via expo-router linking.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api, unwrap } from '@/api/client';

// Foreground presentation: show banners + play sound while the app is open.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request permission, obtain the Expo push token, and register it with the API.
 * No-ops gracefully when permission is denied or on web/simulator without push.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Booking updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#7B1113',
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const expoPushToken = tokenResponse.data;

  try {
    const res = await api.POST('/devices', {
      body: {
        expoPushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName: Constants.deviceName ?? undefined,
      },
    });
    unwrap(res);
  } catch {
    // Non-fatal: registration can be retried on next launch.
    return expoPushToken;
  }

  return expoPushToken;
}

/**
 * Extract a booking id from a notification's data payload, if present, so the
 * tap handler can deep-link to `/booking/<id>`.
 */
export function bookingIdFromNotification(
  response: Notifications.NotificationResponse,
): string | null {
  const data = response.notification.request.content.data as
    | { bookingId?: string; relatedEntityType?: string; relatedEntityId?: string }
    | undefined;
  if (!data) return null;
  if (data.bookingId) return data.bookingId;
  if (data.relatedEntityType === 'booking' && data.relatedEntityId) {
    return data.relatedEntityId;
  }
  return null;
}
