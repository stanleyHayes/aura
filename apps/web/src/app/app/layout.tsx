import { redirect } from "next/navigation";
import { getSession } from "@/lib/api/server";
import { AppShell, type NavSection } from "@/components/app-shell";

const sections: NavSection[] = [
  {
    heading: "Workspace",
    icon: "dashboard",
    items: [
      { href: "/app", label: "Overview", icon: "dashboard", exact: true },
      { href: "/app/search", label: "Find a room", icon: "search" },
      { href: "/app/bookings", label: "My bookings", icon: "ticket" },
      { href: "/app/calendar", label: "Calendar", icon: "calendar" },
      { href: "/app/notifications", label: "Notifications", icon: "bell" },
    ],
  },
  {
    heading: "Account",
    icon: "user",
    items: [
      { href: "/app/guide", label: "User guide", icon: "book-open" },
      { href: "/app/profile", label: "Profile", icon: "user" },
      { href: "/app/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/app");

  return (
    <AppShell sections={sections} title="AURA" session={session}>
      {children}
    </AppShell>
  );
}
