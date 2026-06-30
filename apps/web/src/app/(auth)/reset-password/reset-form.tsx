"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ResetPasswordForm as Schema,
  type ResetPasswordForm as Values,
} from "@cbs/schemas";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
import { Button } from "@cbs/ui/components/button";
import { api, unwrap } from "@/lib/api/client";
import { Field } from "@/components/forms/field";
import { PasswordInput } from "@/components/password-input";
import { ProblemAlert } from "@/components/problem-alert";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = React.useState<unknown>(null);
  const [done, setDone] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { token, password: "", confirm: "" },
  });
  const password = useWatch({ control: form.control, name: "password" }) ?? "";

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      unwrap(
        await api.POST("/api/v1/auth/password/reset", {
          body: { token: values.token, new_password: values.password },
        }),
      );
      setDone(true);
    } catch (err) {
      setError(err);
    }
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Your password has been changed. Please sign in with the new password.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <ProblemAlert error={error} /> : null}
      <Field
        id="password"
        label="New password"
        error={form.formState.errors.password?.message}
        required
      >
        {(p) => (
          <PasswordInput
            {...p}
            placeholder="Enter a new password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        )}
      </Field>
      <PasswordStrength password={password} />
      <Field
        id="confirm"
        label="Confirm password"
        error={form.formState.errors.confirm?.message}
        required
      >
        {(p) => (
          <PasswordInput
            {...p}
            placeholder="Confirm your new password"
            autoComplete="new-password"
            {...form.register("confirm")}
          />
        )}
      </Field>
      <Button
        type="submit"
        loading={form.formState.isSubmitting}
        loadingLabel="Updating password…"
      >
        Update password
      </Button>
    </form>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const label = ["Enter a password", "Weak", "Fair", "Good", "Strong"][score];
  const width = `${Math.max(score, password ? 1 : 0) * 25}%`;

  return (
    <div aria-live="polite" className="-mt-2 rounded-lg bg-[var(--color-muted)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[var(--color-foreground)]">
          Password strength
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-maroon)] transition-[width] motion-reduce:transition-none"
          style={{ width }}
        />
      </div>
      <ul className="mt-2 grid gap-1 text-xs text-[var(--color-muted-foreground)]">
        <li>Use at least 12 characters.</li>
        <li>Mix upper and lower-case letters, numbers and symbols.</li>
      </ul>
    </div>
  );
}
