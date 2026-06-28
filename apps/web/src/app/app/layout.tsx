import { redirect } from "next/navigation";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  Search,
  Ticket,
} from "lucide-react";
import { getSession } from "@/lib/api/server";
import { AppShell, type NavSection } from "@/components/app-shell";

const sections: NavSection[] = [
  {
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/app/search", label: "Find a room", icon: Search },
      { href: "/app/bookings", label: "My bookings", icon: Ticket },
      { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
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
