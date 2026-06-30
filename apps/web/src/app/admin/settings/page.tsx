import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettingsClient } from "@/components/account/settings-client";
import { getSession } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/settings");

  return <AccountSettingsClient session={session} />;
}
