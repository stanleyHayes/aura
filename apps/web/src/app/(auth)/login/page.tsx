import type { Metadata } from "next";
import Link from "next/link";
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
      <LoginForm next={next} />

      <div className="flex flex-col gap-2 text-center text-sm text-[var(--color-muted-foreground)]">
        <p>
          Forgot your password?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--color-primary)] dark:text-[var(--color-maroon-tint)] hover:underline"
          >
            Reset it
          </Link>
        </p>
        <p>Need an account? Contact your department administrator.</p>
      </div>
    </div>
  );
}
