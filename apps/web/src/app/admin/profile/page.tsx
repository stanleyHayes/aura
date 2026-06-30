import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountProfileClient } from "@/components/account/profile-client";
import { getSession } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function AdminProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/profile");

  return <AccountProfileClient session={session} />;
}
