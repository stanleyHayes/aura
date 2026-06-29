"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ForgotPasswordForm as Schema,
  type ForgotPasswordForm as Values,
} from "@cbs/schemas";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
import { api } from "@/lib/api/client";
import { Field } from "@/components/forms/field";

export function ForgotPasswordForm() {
  const [done, setDone] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    // Always succeeds from the user's perspective — no enumeration (§9.1).
    await api.POST("/api/v1/auth/password/forgot", { body: values });
    setDone(true);
  });

  if (done) {
    return (
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          If an account exists for that email, a reset link is on its way.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field id="email" label="Email" error={form.formState.errors.email?.message} required>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            placeholder="you@ashesi.edu.gh"
            {...form.register("email")}
          />
        )}
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
