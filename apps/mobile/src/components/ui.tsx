/**
 * A small, intentional set of styled primitives shared across screens. Uses
 * NativeWind `className` props. Kept deliberately lean — not a component dump.
 */
import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { withAlpha } from '@/components/theme-toggle';
import type { BookingStatus } from '@/schemas';
import { useThemeColors } from '@/theme/theme-context';
import { palette } from '@/theme/tokens';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:opacity-80',
  secondary: 'bg-surface border border-border active:opacity-80',
  danger: 'bg-danger active:opacity-80',
  ghost: 'bg-transparent active:opacity-60',
};

const variantText: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-foreground',
  danger: 'text-white',
  ghost: 'text-primary',
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled ?? false, busy: loading }}
      disabled={isDisabled}
      className={`min-h-12 flex-row items-center justify-center rounded-md px-4 py-3 ${variantClasses[variant]} ${isDisabled ? 'opacity-50' : ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? palette.primary : '#fff'} />
      ) : (
        <Text className={`text-base font-semibold ${variantText[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------- Input */

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, hint, ...rest },
  ref,
) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={palette.muted}
        className={`min-h-12 rounded-md border bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:outline-none ${error ? 'border-danger' : 'border-border'}`}
        {...rest}
      />
      {error ? (
        <Text className="text-xs text-danger">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted">{hint}</Text>
      ) : null}
    </View>
  );
});

/* -------------------------------------------------------------------- Card */

export function Card({ className = '', children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-lg border border-border bg-background p-4 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------ StatusBadge */

/**
 * Each status maps to a semantic theme role (resolved at runtime via
 * `useThemeColors()`), not a fixed Tailwind chip. The chip background is a soft
 * tint of that role and the text uses the role's full strength, so the badge
 * keeps its meaning (approved=green, pending=amber, rejected/cancelled=red/grey)
 * while reading correctly in light, dark, and every dark tint.
 */
type StatusRole = 'success' | 'warning' | 'danger' | 'muted';

const statusRoles: Record<BookingStatus, { role: StatusRole; label: string }> = {
  PENDING: { role: 'warning', label: 'Pending' },
  APPROVED: { role: 'success', label: 'Approved' },
  REJECTED: { role: 'danger', label: 'Rejected' },
  CANCELLED: { role: 'danger', label: 'Cancelled' },
  EXPIRED: { role: 'muted', label: 'Expired' },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const colors = useThemeColors();
  const { role, label } = statusRoles[status];
  const base =
    role === 'success'
      ? colors.success
      : role === 'warning'
        ? colors.warning
        : role === 'danger'
          ? colors.danger
          : colors.mutedForeground;
  return (
    <View
      className="self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: withAlpha(base, 0.15) }}
    >
      <Text className="text-xs font-semibold" style={{ color: base }}>
        {label}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- States */

export function ScreenMessage({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 p-8">
      <Text className="text-center text-lg font-semibold text-foreground">
        {title}
      </Text>
      {message ? (
        <Text className="text-center text-sm text-muted">{message}</Text>
      ) : null}
    </View>
  );
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8">
      <ActivityIndicator color={palette.primary} size="large" />
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

export function Pill({ text }: { text: string }) {
  return (
    <View className="self-start rounded-full bg-primary-muted px-2.5 py-1">
      <Text className="text-xs font-medium text-primary">{text}</Text>
    </View>
  );
}
