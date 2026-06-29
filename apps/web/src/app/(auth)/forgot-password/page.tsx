import type { Metadata } from "next";
import Link from "next/link";
import { MailQuestion } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <AuthHeader
        icon={<MailQuestion className="size-6" />}
        title="Reset your password"
        description="Enter your email and we'll send a reset link if an account exists."
        help={{
          title: "Resetting your password",
          steps: [
            "Enter the email on your AURA account.",
            "Check your inbox for a reset link (and your spam folder).",
            "The link expires after one hour — request a new one if it lapses.",
          ],
        }}
      />
      <ForgotPasswordForm />
      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        <Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
