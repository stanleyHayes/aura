import { Stack } from 'expo-router';

import { palette } from '@/theme/tokens';

export default function BookingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: palette.primary,
        headerTitleStyle: { color: palette.foreground },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My bookings' }} />
    </Stack>
  );
}
