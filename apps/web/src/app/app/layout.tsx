import { redirect } from "next/navigation";
import { getSession } from "@/lib/api/server";
import { AppShell, type NavSection } from "@/components/app-shell";

const sections: NavSection[] = [
  {
    items: [
      { href: "/app", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/app/search", label: "Find a room", icon: "search" },
      { href: "/app/bookings", label: "My bookings", icon: "ticket" },
      { href: "/app/calendar", label: "Calendar", icon: "calendar" },
      { href: "/app/notifications", label: "Notifications", icon: "bell" },
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
    <AppShell sections={sections} title="Requester portal">
      {children}
    </AppShell>
  );
}
