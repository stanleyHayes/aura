"use client";

import * as React from "react";
import type { ComponentType, ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { QRCodeSVG } from "qrcode.react";
import {
  Bell,
  BookOpen,
  Check,
  Copy,
  KeyRound,
  Moon,
  Palette,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  UserRound,
} from "lucide-react";
import {
  ChangePasswordForm as ChangePasswordSchema,
  type ChangePasswordForm as ChangePasswordValues,
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
import { Checkbox } from "@cbs/ui/components/checkbox";
import { Input } from "@cbs/ui/components/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cbs/ui/components/tabs";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import type { AppSession } from "@/lib/session-types";
import { Field } from "@/components/forms/field";
import { PageHeader } from "@/components/page-header";
import { PasswordInput } from "@/components/password-input";
import { ProblemAlert } from "@/components/problem-alert";
import { ProfileSection } from "@/components/account/profile-client";
import {
  DARK_TINT_OPTIONS,
  type DarkTint,
  readSavedDarkTint,
  saveDarkTint,
} from "@/lib/theme-preferences";

const SETTINGS_KEY = "aura-account-settings";

type Preferences = {
  inAppAlerts: boolean;
  spokenGuide: boolean;
  compactTables: boolean;
};

type MfaEnrolment = {
  provisioning_uri: string;
  secret: string;
};

const defaultPreferences: Preferences = {
  inAppAlerts: true,
  spokenGuide: false,
  compactTables: false,
};

function readSavedPreferences(): Preferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    return saved
      ? { ...defaultPreferences, ...JSON.parse(saved) }
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SettingCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function PreferenceRow({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-4"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-semibold text-[var(--color-foreground)]">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-[var(--color-muted-foreground)]">
          {description}
        </span>
      </span>
    </label>
  );
}

function DarkTintPicker({
  value,
  onChange,
}: {
  value: DarkTint;
  onChange: (value: DarkTint) => void;
}) {
  const labelId = React.useId();

  return (
    <div aria-labelledby={labelId} role="radiogroup">
      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-4 text-sm text-[var(--color-muted-foreground)]">
        <span className="flex shrink-0 items-center gap-1 text-[var(--color-foreground)]">
          <Sun className="size-4" aria-hidden />
          <Moon className="size-4" aria-hidden />
        </span>
        <p>
          Use the theme button in the top navigation to switch modes. These
          tints change the dark screen colour only.
        </p>
      </div>

      <p
        id={labelId}
        className="mt-4 text-xs font-medium uppercase text-[var(--color-muted-foreground)]"
      >
        Dark screen tint
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {DARK_TINT_OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <label
              key={option.value}
              className={[
                "relative cursor-pointer rounded-xl border p-3 transition",
                "bg-[color-mix(in_oklch,var(--color-muted)_28%,transparent)] hover:border-[var(--color-maroon)]",
                selected
                  ? "border-[var(--color-maroon)] shadow-[0_0_0_2px_color-mix(in_oklch,var(--color-maroon)_18%,transparent)]"
                  : "border-[var(--color-border)]",
              ].join(" ")}
            >
              <input
                type="radio"
                name="dark-tint"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-[var(--color-foreground)]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-muted-foreground)]">
                    {option.description}
                  </span>
                </span>
                <span
                  className={[
                    "grid size-6 shrink-0 place-items-center rounded-full border",
                    selected
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)] text-[var(--color-primary-foreground)]"
                      : "border-[var(--color-border)] text-transparent",
                  ].join(" ")}
                  aria-hidden
                >
                  <Check className="size-3.5" />
                </span>
              </span>
              <span className="mt-3 flex h-10 overflow-hidden rounded-lg border border-[var(--color-border)]">
                {option.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="flex-1"
                    style={{ backgroundColor: swatch }}
                    aria-hidden
                  />
                ))}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * SecuritySection groups multi-factor authentication and password management —
 * the content of the Settings "Security" tab.
 */
function SecuritySection({ session }: { session: AppSession }) {
  const { user } = session;
  const { toast } = useToast();
  const [passwordError, setPasswordError] = React.useState<unknown>(null);
  const [mfaError, setMfaError] = React.useState<unknown>(null);
  const [mfaEnabled, setMfaEnabled] = React.useState(user.mfa_enabled);
  const [mfaEnrolment, setMfaEnrolment] =
    React.useState<MfaEnrolment | null>(null);
  const [mfaCode, setMfaCode] = React.useState("");

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm: "",
    },
  });

  const changePassword = useMutation({
    mutationFn: async (values: ChangePasswordValues) =>
      unwrap(
        await api.POST("/api/v1/auth/password/change", {
          body: {
            current_password: values.current_password,
            new_password: values.new_password,
          },
        }),
      ),
    onSuccess: () => {
      setPasswordError(null);
      passwordForm.reset();
      toast({
        variant: "success",
        title: "Password updated",
        description: "Use the new password the next time you sign in.",
      });
    },
    onError: setPasswordError,
  });

  const enrolMfa = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/auth/mfa/enrol")),
    onSuccess: (data) => {
      setMfaError(null);
      setMfaEnrolment(data);
      toast({
        variant: "success",
        title: "MFA setup started",
        description: "Add AURA to your authenticator app, then enter the code.",
      });
    },
    onError: setMfaError,
  });

  const verifyMfa = useMutation({
    mutationFn: async () => {
      const code = mfaCode.replace(/\D/g, "");
      if (!/^\d{6}$/.test(code)) {
        throw new Error("Enter the six-digit code from your authenticator app.");
      }
      unwrap(
        await api.POST("/api/v1/auth/mfa/verify", {
          body: { code },
        }),
      );
    },
    onSuccess: () => {
      setMfaEnabled(true);
      setMfaEnrolment(null);
      setMfaCode("");
      setMfaError(null);
      toast({
        variant: "success",
        title: "MFA enabled",
        description: "Your next sign-in will ask for an authenticator code.",
      });
    },
    onError: setMfaError,
  });

  async function copyMfaSecret() {
    if (!mfaEnrolment) return;
    try {
      await navigator.clipboard.writeText(mfaEnrolment.secret);
      toast({ variant: "success", title: "Secret copied" });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Select and copy the setup secret manually.",
      });
    }
  }

  return (
    <div className="grid gap-4">
      <SettingCard
        icon={ShieldCheck}
        title="Multi-factor authentication"
        description="Protect sign-in with a six-digit authenticator code."
      >
        <div className="grid gap-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={mfaEnabled ? "approved" : "pending"}>
                    {mfaEnabled ? "Enabled" : "Not enabled"}
                  </Badge>
                  <span className="text-sm text-[var(--color-muted-foreground)]">
                    {mfaEnabled
                      ? "Authenticator codes are required at sign-in."
                      : "Protect this account with a six-digit authenticator code."}
                  </span>
                </div>
                {!mfaEnabled && !mfaEnrolment ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => enrolMfa.mutate()}
                    loading={enrolMfa.isPending}
                    loadingLabel="Starting MFA setup"
                    className="mt-4 w-full sm:w-fit"
                  >
                    <Smartphone className="size-4" aria-hidden />
                    Enable MFA
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {mfaError ? <ProblemAlert error={mfaError} /> : null}

          {!mfaEnabled && mfaEnrolment ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
                <div className="w-fit rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm">
                  <QRCodeSVG
                    value={mfaEnrolment.provisioning_uri}
                    size={152}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#111111"
                    aria-label="MFA setup QR code"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
                    <Smartphone className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--color-foreground)]">
                      Add AURA to an authenticator app
                    </p>
                    <ol className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-muted-foreground)]">
                      <li>
                        1. Scan the QR code with Google Authenticator, Microsoft
                        Authenticator, 1Password, or another TOTP app.
                      </li>
                      <li>
                        2. If scanning is not available, use the setup link or
                        enter the secret manually.
                      </li>
                      <li>3. Enter the six-digit code from the app to finish.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <Button asChild variant="outline" className="w-full sm:w-fit">
                  <a href={mfaEnrolment.provisioning_uri}>
                    <Smartphone className="size-4" aria-hidden />
                    Open authenticator setup
                  </a>
                </Button>

                <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-3">
                  <p className="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                    Manual setup secret
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 break-all rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-sm text-[var(--color-foreground)]">
                      {mfaEnrolment.secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyMfaSecret}
                      className="w-full sm:w-fit"
                    >
                      <Copy className="size-4" aria-hidden />
                      Copy
                    </Button>
                  </div>
                </div>

                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    verifyMfa.mutate();
                  }}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter six-digit code"
                    value={mfaCode}
                    maxLength={6}
                    onChange={(event) =>
                      setMfaCode(
                        event.currentTarget.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    aria-label="Authenticator code"
                  />
                  <Button
                    type="submit"
                    loading={verifyMfa.isPending}
                    loadingLabel="Verifying code"
                  >
                    <ShieldCheck className="size-4" aria-hidden />
                    Verify and enable
                  </Button>
                </form>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-3">
            <p className="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
              Last sign in
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatDateTime(user.last_login_at)}
            </p>
          </div>
        </div>
      </SettingCard>

      <SettingCard
        icon={KeyRound}
        title="Password"
        description="Change your password with your current password."
      >
        {passwordError ? <ProblemAlert error={passwordError} /> : null}
        <form
          className="mt-4 grid gap-4"
          onSubmit={passwordForm.handleSubmit((values) =>
            changePassword.mutate(values),
          )}
        >
          <Field
            id="current-password"
            label="Current password"
            error={passwordForm.formState.errors.current_password?.message}
            required
          >
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="current-password"
                placeholder="Enter your current password"
                {...passwordForm.register("current_password")}
              />
            )}
          </Field>
          <Field
            id="new-password"
            label="New password"
            error={passwordForm.formState.errors.new_password?.message}
            required
          >
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="new-password"
                placeholder="Enter a new password"
                {...passwordForm.register("new_password")}
              />
            )}
          </Field>
          <Field
            id="confirm-password"
            label="Confirm password"
            error={passwordForm.formState.errors.confirm?.message}
            required
          >
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="new-password"
                placeholder="Confirm your new password"
                {...passwordForm.register("confirm")}
              />
            )}
          </Field>
          <Button
            type="submit"
            className="w-full sm:w-fit"
            loading={changePassword.isPending}
            loadingLabel="Updating password"
          >
            <Save className="size-4" aria-hidden />
            Update password
          </Button>
        </form>
      </SettingCard>
    </div>
  );
}

export function AccountSettingsClient({ session }: { session: AppSession }) {
  const { toast } = useToast();
  const [preferences, setPreferences] =
    React.useState<Preferences>(readSavedPreferences);
  const [darkTint, setDarkTint] = React.useState<DarkTint>(readSavedDarkTint);

  function updatePreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function savePreferences() {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
    toast({ variant: "success", title: "Settings updated" });
  }

  function updateDarkTint(nextTint: DarkTint) {
    setDarkTint(nextTint);
    saveDarkTint(nextTint);
  }

  return (
    <>
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Manage your profile, security, notifications and preferences."
      />

      <Tabs defaultValue="profile" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <UserRound className="size-4" aria-hidden />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <ShieldCheck className="size-4" aria-hidden />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="size-4" aria-hidden />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              Preferences
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <ProfileSection session={session} />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySection session={session} />
        </TabsContent>

        <TabsContent value="notifications">
          <SettingCard
            icon={Bell}
            title="Notifications"
            description="Choose how AURA alerts you in this browser."
          >
            <div className="grid gap-3">
              <PreferenceRow
                checked={preferences.inAppAlerts}
                title="In-app alerts"
                description="Show booking and approval alerts in the top navigation."
                onChange={(checked) => updatePreference("inAppAlerts", checked)}
              />
              <Button
                type="button"
                className="w-full sm:w-fit"
                onClick={savePreferences}
              >
                <Save className="size-4" aria-hidden />
                Save notifications
              </Button>
            </div>
          </SettingCard>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="grid gap-4">
            <SettingCard
              icon={SlidersHorizontal}
              title="Preferences"
              description="Tune how this browser presents AURA."
            >
              <div className="grid gap-3">
                <PreferenceRow
                  checked={preferences.spokenGuide}
                  title="Spoken guide"
                  description="Prefer the page guide controls when walkthroughs are available."
                  onChange={(checked) =>
                    updatePreference("spokenGuide", checked)
                  }
                />
                <PreferenceRow
                  checked={preferences.compactTables}
                  title="Compact tables"
                  description="Use tighter row spacing for dense admin tables on this browser."
                  onChange={(checked) =>
                    updatePreference("compactTables", checked)
                  }
                />
                <Button
                  type="button"
                  className="w-full sm:w-fit"
                  onClick={savePreferences}
                >
                  <Save className="size-4" aria-hidden />
                  Save preferences
                </Button>
              </div>
            </SettingCard>

            <SettingCard
              icon={Palette}
              title="Appearance"
              description="Theme preference is saved on this browser."
            >
              <DarkTintPicker value={darkTint} onChange={updateDarkTint} />
            </SettingCard>

            <SettingCard
              icon={BookOpen}
              title="Guide"
              description="Guide reference and first-login tour controls."
            >
              <p className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                User guide opens the dedicated workflow reference. Replay tour
                starts the step-by-step dashboard tour again.
              </p>
            </SettingCard>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
