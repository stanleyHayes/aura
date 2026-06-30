"use client";

import * as React from "react";
import type { ComponentType, ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import {
  Building2,
  CalendarClock,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  ProfileForm as ProfileSchema,
  ROLE_LABELS,
  type ProfileForm as ProfileValues,
} from "@cbs/schemas";
import { Badge } from "@cbs/ui/components/badge";
import { Button } from "@cbs/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cbs/ui/components/card";
import { Input } from "@cbs/ui/components/input";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import type { AppSession } from "@/lib/session-types";
import { useDepartments } from "@/lib/hooks/reference";
import { Combobox } from "@/components/combobox";
import { Field } from "@/components/forms/field";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function statusVariant(status: string): "approved" | "rejected" | "pending" {
  if (status === "ACTIVE") return "approved";
  if (status === "SUSPENDED") return "rejected";
  return "pending";
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--color-card)] text-[var(--color-muted-foreground)] shadow-sm">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
          {label}
        </p>
        <div className="mt-0.5 truncate text-sm font-semibold text-[var(--color-foreground)]">
          {value}
        </div>
      </div>
    </div>
  );
}

export function AccountProfileClient({
  session: initialSession,
}: {
  session: AppSession;
}) {
  const [session, setSession] = React.useState(initialSession);
  const [error, setError] = React.useState<unknown>(null);
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const departments = useDepartments();
  const { user, permissions } = session;
  const settingsHref = pathname.startsWith("/admin")
    ? "/admin/settings"
    : "/app/settings";

  const form = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      full_name: user.full_name,
      department_id: user.department_id ?? "",
    },
  });
  const departmentValue =
    useWatch({ control: form.control, name: "department_id" }) || "";

  React.useEffect(() => {
    form.reset({
      full_name: session.user.full_name,
      department_id: session.user.department_id ?? "",
    });
  }, [form, session]);

  const updateProfile = useMutation({
    mutationFn: async (values: ProfileValues) =>
      unwrap(
        await api.PATCH("/api/v1/auth/me", {
          body: {
            full_name: values.full_name.trim(),
            department_id: values.department_id || null,
          },
        }),
      ),
    onSuccess: (nextSession) => {
      setSession(nextSession);
      queryClient.setQueryData(qk.session, nextSession);
      setError(null);
      toast({ variant: "success", title: "Profile updated" });
    },
    onError: setError,
  });

  return (
    <>
      <PageHeader
        icon={UserRound}
        title="Profile"
        description="Your AURA identity, department, and access details."
      />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>
              Keep your display name and department details current.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {error ? <ProblemAlert error={error} /> : null}
            <form
              className="mt-4 grid gap-4"
              onSubmit={form.handleSubmit((values) =>
                updateProfile.mutate(values),
              )}
            >
              <Field
                id="profile-full-name"
                label="Full name"
                error={form.formState.errors.full_name?.message}
                required
              >
                {(p) => (
                  <Input
                    {...p}
                    autoComplete="name"
                    placeholder="Your full name"
                    {...form.register("full_name")}
                  />
                )}
              </Field>

              <Field
                id="profile-email"
                label="Email"
                description="Your sign-in email is managed by your administrator."
              >
                {(p) => (
                  <Input
                    {...p}
                    value={user.email}
                    readOnly
                    className="bg-[var(--color-muted)]"
                  />
                )}
              </Field>

              <Field
                id="profile-department"
                label="Department"
                error={form.formState.errors.department_id?.message}
              >
                {(p) => (
                  <Combobox
                    id={p.id}
                    value={departmentValue}
                    onValueChange={(value) =>
                      form.setValue("department_id", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    disabled={departments.isLoading}
                    placeholder="Select department"
                    searchPlaceholder="Search departments…"
                    emptyText="No departments found."
                    options={[
                      { value: "", label: "Not assigned" },
                      ...(departments.data ?? []).map((department) => ({
                        value: department.id,
                        label: department.name,
                        description: department.code,
                      })),
                    ]}
                  />
                )}
              </Field>

              <Button
                type="submit"
                className="w-full sm:w-fit"
                loading={updateProfile.isPending}
                loadingLabel="Saving profile"
              >
                <Save className="size-4" aria-hidden />
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{user.full_name}</CardTitle>
              <CardDescription>{ROLE_LABELS[user.role]}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 xl:grid-cols-1">
              <ProfileRow icon={Mail} label="Email" value={user.email} />
              <ProfileRow
                icon={ShieldCheck}
                label="Account status"
                value={
                  <Badge variant={statusVariant(user.status)}>
                    {formatStatus(user.status)}
                  </Badge>
                }
              />
              <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--color-card)] text-[var(--color-muted-foreground)] shadow-sm">
                  <ShieldCheck className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                    Multi-factor auth
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={user.mfa_enabled ? "approved" : "pending"}>
                      {user.mfa_enabled ? "Enabled" : "Not enabled"}
                    </Badge>
                    {!user.mfa_enabled ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={settingsHref}>Enable in settings</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <ProfileRow
                icon={Building2}
                label="Department"
                value={user.department?.name ?? "Not assigned"}
              />
              <ProfileRow
                icon={CalendarClock}
                label="Last sign in"
                value={formatDateTime(user.last_login_at)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access summary</CardTitle>
              <CardDescription>
                Permissions are assigned from your role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-4">
                <p className="text-3xl font-semibold tabular-nums">
                  {permissions.length}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  Active permission{permissions.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {permissions.length === 0 ? (
                  <span className="text-sm text-[var(--color-muted-foreground)]">
                    No extra permissions are attached to this account.
                  </span>
                ) : (
                  permissions.slice(0, 8).map((permission) => (
                    <Badge key={permission} variant="outline">
                      {permission}
                    </Badge>
                  ))
                )}
                {permissions.length > 8 ? (
                  <Badge variant="secondary">
                    +{permissions.length - 8} more
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
