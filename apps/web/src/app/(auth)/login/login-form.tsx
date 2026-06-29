"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginForm as LoginSchema, type LoginForm as LoginValues } from "@cbs/schemas";
import { ApiError } from "@cbs/api-client";
import { ERROR_CODES } from "@cbs/schemas";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
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
    if (mfaRequired && !values.mfa_code?.trim()) {
      form.setError("mfa_code", { message: "Enter your authentication code." });
      return;
    }

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
        setSubmitError(null);
        return;
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
            placeholder="you@ashesi.edu.gh"
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
        <>
          <Alert variant="info">
            <ShieldCheck />
            <AlertTitle>Authenticator required</AlertTitle>
            <AlertDescription>
              Enter the current code from your authenticator app to finish
              signing in.
            </AlertDescription>
          </Alert>
          <Field
            id="mfa_code"
            label="Authentication code"
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
        </>
      ) : null}

      <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
        {form.formState.isSubmitting ? "Signing in…" : "Sign in to AURA"}
      </Button>
    </form>
  );
}
