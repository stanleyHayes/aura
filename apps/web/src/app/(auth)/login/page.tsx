import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to AURA — Ashesi University Resource Allocation.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader
        icon={<KeyRound className="size-6" />}
        title="Sign in to AURA"
        description="Access your Ashesi classrooms and campus facilities."
        help={{
          title: "Signing in",
          steps: [
            "Use your Ashesi email and password.",
            "If two-factor is enabled, enter the 6-digit code next.",
            "Forgotten your password? Use the reset link below.",
            "No account yet? Ask your department administrator to create one.",
          ],
        }}
      />

      <LoginForm next={next} />

      <div className="flex flex-col gap-2 text-center text-sm text-[var(--color-muted-foreground)]">
        <p>
          Forgot your password?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Reset it
          </Link>
        </p>
        <p>Need an account? Contact your department administrator.</p>
      </div>
    </div>
  );
}
