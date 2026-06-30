import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
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
      <AuthHeader
        icon={<LockKeyhole className="size-6" />}
        title="Set a new password"
        description="Choose a strong password you don't use elsewhere."
        help={{
          title: "Choosing a password",
          steps: [
            "Use at least 12 characters.",
            "Mix letters, numbers and symbols for strength.",
            "Saving signs you out of all other sessions.",
          ],
        }}
      />
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
