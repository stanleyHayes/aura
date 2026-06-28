import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Choose a strong password you don&apos;t use elsewhere.
        </p>
      </div>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-[var(--color-destructive)]">
          This reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-medium hover:underline">
            reset page
          </Link>
          .
        </p>
      )}
    </div>
  );
}
