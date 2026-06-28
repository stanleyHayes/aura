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
import { useAuth } from '@/features/auth/auth-context';

const LoginForm = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
  mfaCode: z.string().optional(),
});
type LoginForm = z.infer<typeof LoginForm>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginForm),
    defaultValues: { email: '', password: '', mfaCode: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
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
          setFormError('Enter the code from your authenticator app.');
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-6 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Classroom Booking
            </Text>
            <Text className="text-sm text-muted">
              Sign in to search rooms, request bookings and manage approvals.
            </Text>
          </View>

          <View className="gap-4">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label="Email"
                  placeholder="you@university.edu"
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
                  placeholder="••••••••"
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
              <Text className="text-sm text-danger">{formError}</Text>
            ) : null}

            <Button
              label="Sign in"
              loading={isSubmitting}
              onPress={onSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
