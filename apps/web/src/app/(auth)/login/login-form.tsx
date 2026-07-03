"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginForm as LoginSchema, type LoginForm as LoginValues } from "@cbs/schemas";
import { ApiError } from "@cbs/api-client";
import { ERROR_CODES } from "@cbs/schemas";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { api, unwrap } from "@/lib/api/client";
import { defaultLandingPath, safeRedirectPath } from "@/lib/auth";
import { route } from "@/lib/route";
import { AuthHeader } from "@/components/auth-header";
import { Field } from "@/components/forms/field";
import { PasswordInput } from "@/components/password-input";
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
      const target = safeRedirectPath(next, defaultLandingPath(session.user.role));
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

  const header = mfaRequired
    ? {
        icon: <ShieldCheck className="size-6" />,
        title: "Two-factor verification",
        description: "Enter the 6-digit code from your authenticator app.",
        help: {
          title: "Verifying your sign-in",
          steps: [
            "Open the authenticator app linked to your AURA account.",
            "Enter the current 6-digit code before it refreshes.",
            "If you have lost the device, contact your department administrator.",
          ],
        },
      }
    : {
        icon: <KeyRound className="size-6" />,
        title: "Sign in to AURA",
        description: "Access your Ashesi classrooms and facilities.",
        help: {
          title: "Signing in",
          steps: [
            "Use your Ashesi email and password.",
            "If two-factor is enabled, enter the 6-digit code next.",
            "Forgotten your password? Use the reset link below.",
            "No account yet? Ask your department administrator to create one.",
          ],
        },
      };

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader {...header} />

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
            <PasswordInput
              {...p}
              placeholder="Enter your password"
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

        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          loadingLabel={mfaRequired ? "Verifying…" : "Signing in…"}
          className="mt-2 w-full [--aura-button-slant:0.9rem]"
        >
          {mfaRequired ? "Verify" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
