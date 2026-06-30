/**
 * Appearance settings — mode (light / dark / system) + dark-tint picker.
 *
 * Mirrors the web's DarkTintPicker (`apps/web/src/components/account/
 * settings-client.tsx`): a segmented mode control plus a grid of tint cards,
 * each showing a label, description, selection tick, and a 3-stop swatch strip.
 * Selecting either persists immediately via the theme context.
 */
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import {
  DARK_TINT_OPTIONS,
  type ThemeMode,
} from '@/lib/theme-preferences';
import { useTheme } from '@/theme/theme-context';

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function ModeSegment() {
  const { mode, setMode, colors } = useTheme();
  return (
    <View
      className="flex-row rounded-md p-1"
      style={{ backgroundColor: colors.muted }}
    >
      {MODE_OPTIONS.map((option) => {
        const selected = option.value === mode;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setMode(option.value)}
            className="flex-1 items-center rounded-sm py-2"
            style={{
              backgroundColor: selected ? colors.card : 'transparent',
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{
                color: selected ? colors.foreground : colors.mutedForeground,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TintCard({
  value,
  label,
  description,
  swatches,
}: {
  value: (typeof DARK_TINT_OPTIONS)[number]['value'];
  label: string;
  description: string;
  swatches: readonly string[];
}) {
  const { tint, setTint, colors } = useTheme();
  const selected = value === tint;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => setTint(value)}
      className="rounded-lg border p-3"
      style={{
        borderColor: selected ? colors.primary : colors.border,
        borderWidth: selected ? 2 : 1,
        backgroundColor: colors.card,
      }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.foreground }}
          >
            {label}
          </Text>
          <Text
            className="mt-1 text-xs leading-5"
            style={{ color: colors.mutedForeground }}
          >
            {description}
          </Text>
        </View>
        <View
          className="size-6 items-center justify-center rounded-full"
          style={{
            backgroundColor: selected ? colors.primary : 'transparent',
            borderWidth: selected ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          {selected ? (
            <Text style={{ color: colors.primaryForeground, fontSize: 12 }}>
              ✓
            </Text>
          ) : null}
        </View>
      </View>
      <View
        className="mt-3 h-10 flex-row overflow-hidden rounded-md"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        {swatches.map((swatch) => (
          <View
            key={swatch}
            className="flex-1"
            style={{ backgroundColor: swatch }}
          />
        ))}
      </View>
    </Pressable>
  );
}

export function ThemeSettings() {
  const { colors } = useTheme();
  return (
    <Card className="gap-3">
      <Text className="text-xs font-medium uppercase text-muted">
        Appearance
      </Text>

      <ModeSegment />

      <View
        className="flex-row items-start gap-2 rounded-md p-3"
        style={{ backgroundColor: colors.muted }}
      >
        <Text style={{ color: colors.foreground }}>☀︎/☾</Text>
        <Text className="flex-1 text-xs leading-5" style={{ color: colors.mutedForeground }}>
          These tints change the dark screen colour only. Switch to Dark (or
          System at night) to see them applied.
        </Text>
      </View>

      <Text className="text-xs font-medium uppercase text-muted">
        Dark screen tint
      </Text>
      <View className="gap-3">
        {DARK_TINT_OPTIONS.map((option) => (
          <TintCard
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
            swatches={option.swatches}
          />
        ))}
      </View>
    </Card>
  );
}
