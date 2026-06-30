/**
 * Requester tab navigator: Search availability, My bookings, Notifications,
 * Settings (Section 13 screens). Uses simple text-glyph tab icons to avoid an
 * extra icon dependency in the scaffold.
 */
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { ThemeToggle } from '@/components/theme-toggle';
import { palette } from '@/theme/tokens';
import { useThemeColors } from '@/theme/theme-context';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function RequesterLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        headerRight: () => <ThemeToggle />,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <TabIcon glyph="🔍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'My bookings',
          tabBarIcon: ({ color }) => <TabIcon glyph="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => <TabIcon glyph="🔔" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon glyph="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}
