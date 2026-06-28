"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginForm as LoginSchema, type LoginForm as LoginValues } from "@cbs/schemas";
import { ApiError } from "@cbs/api-client";
import { ERROR_CODES } from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { api, unwrap } from "@/lib/api/client";
import { defaultLandingPath } from "@/lib/auth";
import { route } from "@/lib/route";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<unknown>(null);
  const [mfaRequired, setMfaRequired] = React.useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "", mfa_code: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const session = unwrap(
        await api.POST("/api/v1/auth/login", {
          body: {
            email: values.email,
            password: values.password,
            mfa_code: values.mfa_code || undefined,
          },
        }),
      );
      const target = next || defaultLandingPath(session.user.role);
      router.replace(route(target));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === ERROR_CODES.MFA_REQUIRED) {
        setMfaRequired(true);
      }
      setSubmitError(err);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {submitError ? <ProblemAlert error={submitError} /> : null}

      <Field id="email" label="Email" error={form.formState.errors.email?.message} required>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="you@university.edu"
            {...form.register("email")}
          />
        )}
      </Field>

      <Field
        id="password"
        label="Password"
        error={form.formState.errors.password?.message}
        required
      >
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        )}
      </Field>

      {mfaRequired ? (
        <Field
          id="mfa_code"
          label="Authentication code"
          description="Enter the six-digit code from your authenticator app."
          error={form.formState.errors.mfa_code?.message}
        >
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              {...form.register("mfa_code")}
            />
          )}
        </Field>
      ) : null}

      <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
