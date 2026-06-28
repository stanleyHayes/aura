import { Stack } from 'expo-router';

import { palette } from '@/theme/tokens';

export default function SearchStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: palette.primary,
        headerTitleStyle: { color: palette.foreground },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Search availability' }} />
      <Stack.Screen name="results" options={{ title: 'Available rooms' }} />
      <Stack.Screen name="request" options={{ title: 'Request booking' }} />
    </Stack>
  );
}
