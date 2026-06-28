import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Enter your email and we&apos;ll send a reset link if an account exists.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        <Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
