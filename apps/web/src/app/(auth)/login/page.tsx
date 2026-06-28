import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Roomwise to search availability and book rooms.",
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
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Sign in with your university account.
        </p>
      </div>

      <LoginForm next={next} />

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        Forgot your password?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-[var(--color-primary)] hover:underline"
        >
          Reset it
        </Link>
      </p>
    </div>
  );
}
