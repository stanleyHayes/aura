/**
 * Booking officer tab navigator: Approvals queue, Notifications, Settings
 * (Section 13). Officers can also reach the requester search via deep navigation
 * but their primary surface is the approvals queue.
 */
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { palette } from '@/theme/tokens';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function OfficerLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        headerTitleStyle: { color: palette.foreground },
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
