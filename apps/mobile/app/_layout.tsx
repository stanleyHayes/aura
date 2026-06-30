/**
 * Root layout. Wires providers, Sentry, notification deep-linking, and the
 * top-level auth gate that routes between the (auth) group and the
 * role-based app groups.
 */
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { Providers } from '@/components/providers';
import { LoadingScreen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { bookingIdFromNotification } from '@/lib/push';
import { Sentry, initSentry } from '@/lib/sentry';
import { useTheme } from '@/theme/theme-context';

initSentry();

// Keep the native splash up until the Outfit typeface (BRAND.md) has loaded so
// text never flashes in the system font first.
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();
  const { colors } = useTheme();
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
    if (Platform.OS === 'web') return;

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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(requester)" />
      <Stack.Screen name="(officer)" />
      <Stack.Screen
        name="booking/[id]"
        options={{
          headerShown: true,
          title: 'Booking',
          presentation: 'card',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { color: colors.foreground },
        }}
      />
    </Stack>
  );
}

/** StatusBar that follows the active theme (light glyphs on dark screens). */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootLayout() {
  // Load the Outfit typeface (BRAND.md). `tailwind.config.js` sets these family
  // names as the default `sans`, so existing text picks them up once loaded.
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  // Reveal the app once fonts are ready (or if loading failed — never block the
  // UI on a font, just fall back to the system face).
  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Providers>
        <ThemedStatusBar />
        <RootNavigator />
      </Providers>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
