/**
 * Login screen (Section 9.1 — email + password + optional MFA code → bearer
 * tokens in SecureStore). Lockout is server-driven; we surface the RFC 9457
 * `ACCOUNT_LOCKED` problem and field-level errors.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { Button, Field } from '@/components/ui';
import { withAlpha } from '@/components/theme-toggle';
import { useAuth } from '@/features/auth/auth-context';
import { useThemeColors } from '@/theme/theme-context';

const LoginFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
  mfaCode: z.string().optional(),
});
type LoginForm = z.infer<typeof LoginFormSchema>;

const AURA_CUES = [
  { label: 'Live room availability', value: 'Now' },
  { label: 'Approval workflow', value: 'Ready' },
  { label: 'Campus schedule sync', value: 'Aligned' },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const colors = useThemeColors();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: '', password: '', mfaCode: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (needsMfa && !values.mfaCode?.trim()) {
      setError('mfaCode', { message: 'Enter your authentication code' });
      return;
    }

    try {
      await login({
        email: values.email.trim(),
        password: values.password,
        mfaCode: values.mfaCode?.trim() || undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'MFA_REQUIRED') {
          setNeedsMfa(true);
          setFormError(null);
          return;
        }
        if (err.isLocked) {
          setFormError(
            'Your account is temporarily locked after too many attempts. Please wait and try again.',
          );
          return;
        }
        // Map any field-level problems (Section 8.2).
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field === 'email' || field === 'password' || field === 'mfaCode') {
            setError(field, { message });
          }
        }
        setFormError(err.message);
        return;
      }
      setFormError('Could not sign in. Check your connection and try again.');
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full flex-1 justify-center gap-5 self-center" style={{ maxWidth: 540 }}>
            <View className="overflow-hidden rounded-xl bg-primary">
              <View className="border-b border-white/20 px-5 py-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="gap-1">
                    <Text className="text-xs font-semibold uppercase text-white">
                      Ashesi University
                    </Text>
                    <Text className="text-3xl font-bold text-white">AURA</Text>
                  </View>
                  <View className="rounded-full bg-white px-3 py-1.5">
                    <Text className="text-xs font-semibold text-primary">
                      Secure access
                    </Text>
                  </View>
                </View>
              </View>

              <View className="gap-5 p-5">
                <View className="gap-2">
                  <Text className="text-2xl font-bold text-white">
                    Smart Space Management for Ashesi.
                  </Text>
                  <Text className="text-sm text-white" style={{ opacity: 0.82 }}>
                    Sign in to reserve campus spaces, review requests, and stay
                    aligned with the academic timetable.
                  </Text>
                </View>

                <View className="gap-2">
                  {AURA_CUES.map((cue) => (
                    <View
                      key={cue.label}
                      className="flex-row items-center justify-between rounded-lg border border-white/20 px-3 py-2"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <Text className="text-sm text-white" style={{ opacity: 0.86 }}>
                        {cue.label}
                      </Text>
                      <Text className="text-sm font-semibold text-white">
                        {cue.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <View className="gap-1">
                <Text className="text-xs font-semibold uppercase text-primary">
                  Sign in
                </Text>
                <Text className="text-2xl font-bold text-foreground">
                  Welcome back
                </Text>
                <Text className="text-sm text-muted">
                  Use your Ashesi account to continue to AURA.
                </Text>
              </View>

              <View className="mt-5 gap-4">
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Field
                      label="Email"
                      placeholder="you@ashesi.edu.gh"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="username"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.email?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Field
                      label="Password"
                      placeholder="Enter your password"
                      secureTextEntry
                      autoCapitalize="none"
                      textContentType="password"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.password?.message}
                    />
                  )}
                />

                {needsMfa ? (
                  <View className="rounded-lg border border-primary bg-primary-muted p-3">
                    <Text className="text-sm font-semibold text-primary">
                      Authenticator required
                    </Text>
                    <Text className="mt-1 text-sm text-foreground">
                      Enter the current code from your authenticator app to
                      finish signing in.
                    </Text>
                  </View>
                ) : null}

                {needsMfa ? (
                  <Controller
                    control={control}
                    name="mfaCode"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Authentication code"
                        placeholder="123456"
                        keyboardType="number-pad"
                        maxLength={8}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.mfaCode?.message}
                        hint="From your authenticator app"
                      />
                    )}
                  />
                ) : null}

                {formError ? (
                  <View
                    accessibilityRole="alert"
                    className="rounded-lg border p-3"
                    style={{
                      // Soft danger surface derived from the active theme so it
                      // reads correctly in light AND every dark tint.
                      backgroundColor: withAlpha(colors.danger, 0.12),
                      borderColor: withAlpha(colors.danger, 0.4),
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.danger }}
                    >
                      Sign-in problem
                    </Text>
                    <Text className="mt-1 text-sm text-foreground">{formError}</Text>
                  </View>
                ) : null}

                <Button
                  label="Sign in to AURA"
                  loading={isSubmitting}
                  onPress={onSubmit}
                />
              </View>
            </View>

            <View className="rounded-lg border border-border bg-background px-4 py-3">
              <Text className="text-xs font-semibold uppercase text-muted">
                Account access
              </Text>
              <Text className="mt-1 text-sm text-foreground">
                Access is managed by Ashesi administrative teams.
              </Text>
              <Text className="mt-1 text-xs text-muted">
                Contact your department administrator if your account is not ready.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
