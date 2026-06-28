import { redirect } from "next/navigation";
import {
  Building2,
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Upload,
  Users,
  Wrench,
} from "lucide-react";
import type { Permission } from "@cbs/schemas";
import { getSession } from "@/lib/api/server";
import { canAccessAdmin } from "@/lib/auth";
import { AppShell, type NavItem, type NavSection } from "@/components/app-shell";

interface GatedItem extends NavItem {
  permission?: Permission;
}

const allSections: { heading?: string; items: GatedItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      {
        href: "/admin/approvals",
        label: "Approvals",
        icon: ClipboardCheck,
        permission: "booking.approve",
      },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    heading: "Catalogue",
    items: [
      {
        href: "/admin/rooms",
        label: "Rooms",
        icon: DoorOpen,
        permission: "room.manage",
      },
      {
        href: "/admin/buildings",
        label: "Buildings",
        icon: Building2,
        permission: "room.manage",
      },
      {
        href: "/admin/equipment",
        label: "Equipment",
        icon: Wrench,
        permission: "room.manage",
      },
    ],
  },
  {
    heading: "Scheduling",
    items: [
      {
        href: "/admin/semesters",
        label: "Semesters",
        icon: CalendarCog,
        permission: "semester.manage",
      },
      {
        href: "/admin/timetable",
        label: "Timetable",
        icon: Upload,
        permission: "timetable.manage",
      },
      {
        href: "/admin/maintenance",
        label: "Maintenance",
        icon: Wrench,
        permission: "maintenance.manage",
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        permission: "user.manage",
      },
      {
        href: "/admin/departments",
        label: "Departments",
        icon: GraduationCap,
        permission: "user.manage",
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: FileBarChart,
        permission: "report.view",
      },
      {
        href: "/admin/audit",
        label: "Audit log",
        icon: ScrollText,
        permission: "user.manage",
      },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!canAccessAdmin(session.user.role)) redirect("/app");

  const perms = new Set(session.permissions);

  // Filter nav to what this role can actually do (§9.4); empty sections drop.
  const sections: NavSection[] = allSections
    .map((section) => ({
      heading: section.heading,
      items: section.items.filter(
        (item) => !item.permission || perms.has(item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <AppShell sections={sections} title="Admin console">
      {children}
    </AppShell>
  );
}
