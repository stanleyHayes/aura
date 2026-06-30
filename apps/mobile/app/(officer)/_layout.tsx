/**
 * Booking officer tab navigator: Approvals queue, Notifications, Settings
 * (Section 13). Officers can also reach the requester search via deep navigation
 * but their primary surface is the approvals queue.
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { ThemeToggle } from '@/components/theme-toggle';
import { palette } from '@/theme/tokens';
import { useThemeColors } from '@/theme/theme-context';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function OfficerLayout() {
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
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color }) => <TabIcon glyph="✅" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => (
            <Ionicons name="stats-chart-outline" size={18} color={color} />
          ),
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
