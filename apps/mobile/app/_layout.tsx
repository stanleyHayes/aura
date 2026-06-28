/**
 * Root layout. Wires providers, Sentry, notification deep-linking, and the
 * top-level auth gate that routes between the (auth) group and the
 * role-based app groups.
 */
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { Providers } from '@/components/providers';
import { LoadingScreen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { bookingIdFromNotification } from '@/lib/push';
import { Sentry, initSentry } from '@/lib/sentry';

initSentry();

function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Auth gate: redirect based on session state and current route group.
  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  // Deep link: tapping a push notification opens the relevant booking.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const bookingId = bookingIdFromNotification(response);
        if (bookingId) router.push(`/booking/${bookingId}`);
      },
    );
    // Handle a notification that cold-started the app.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const bookingId = bookingIdFromNotification(response);
      if (bookingId) router.push(`/booking/${bookingId}`);
    });
    return () => sub.remove();
  }, [router]);

  if (status === 'loading') {
    return <LoadingScreen label="Starting up…" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(requester)" />
      <Stack.Screen name="(officer)" />
      <Stack.Screen
        name="booking/[id]"
        options={{ headerShown: true, title: 'Booking', presentation: 'card' }}
      />
    </Stack>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <Providers>
        <StatusBar style="dark" />
        <RootNavigator />
      </Providers>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
