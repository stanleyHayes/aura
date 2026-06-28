"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ResetPasswordForm as Schema,
  type ResetPasswordForm as Values,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<unknown>(null);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { token, password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      unwrap(
        await api.POST("/api/v1/auth/password/reset", {
          body: { token: values.token, password: values.password },
        }),
      );
      toast({ variant: "success", title: "Password updated", description: "Please sign in." });
      router.replace("/login");
    } catch (err) {
      setError(err);
    }
  });

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
          <Input
            {...p}
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        )}
      </Field>
      <Field
        id="confirm"
        label="Confirm password"
        error={form.formState.errors.confirm?.message}
        required
      >
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="new-password"
            {...form.register("confirm")}
          />
        )}
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
