import { redirect } from "next/navigation";
import type { Permission } from "@cbs/schemas";
import { getSession } from "@/lib/api/server";
import { canAccessAdmin } from "@/lib/auth";
import {
  AppShell,
  type IconKey,
  type NavItem,
  type NavSection,
} from "@/components/app-shell";

interface GatedItem extends NavItem {
  permission?: Permission;
}

interface GatedSection {
  heading?: string;
  icon?: IconKey;
  items: GatedItem[];
}

const allSections: GatedSection[] = [
  {
    heading: "Overview",
    icon: "dashboard",
    items: [
      { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
      {
        href: "/admin/approvals",
        label: "Approvals",
        icon: "clipboard-check",
        permission: "booking.approve",
      },
      { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    heading: "Catalogue",
    icon: "door",
    items: [
      {
        href: "/admin/rooms",
        label: "Rooms",
        icon: "door",
        permission: "room.manage",
      },
      {
        href: "/admin/buildings",
        label: "Buildings",
        icon: "building",
        permission: "room.manage",
      },
      {
        href: "/admin/equipment",
        label: "Equipment",
        icon: "wrench",
        permission: "room.manage",
      },
    ],
  },
  {
    heading: "Scheduling",
    icon: "calendar-cog",
    items: [
      {
        href: "/admin/semesters",
        label: "Semesters",
        icon: "calendar-cog",
        permission: "semester.manage",
      },
      {
        href: "/admin/timetable",
        label: "Timetable",
        icon: "upload",
        permission: "timetable.manage",
      },
      {
        href: "/admin/maintenance",
        label: "Maintenance",
        icon: "wrench",
        permission: "maintenance.manage",
      },
    ],
  },
  {
    heading: "Administration",
    icon: "users",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: "users",
        permission: "user.manage",
      },
      {
        href: "/admin/departments",
        label: "Departments",
        icon: "graduation-cap",
        permission: "user.manage",
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: "file-bar-chart",
        permission: "report.view",
      },
      {
        href: "/admin/audit",
        label: "Audit log",
        icon: "scroll-text",
        permission: "audit.view",
      },
    ],
  },
  {
    heading: "Account",
    icon: "user",
    items: [
      { href: "/admin/guide", label: "User guide", icon: "book-open" },
      { href: "/admin/profile", label: "Profile", icon: "user" },
      { href: "/admin/settings", label: "Settings", icon: "settings" },
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
      icon: section.icon,
      items: section.items.filter(
        (item) => !item.permission || perms.has(item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <AppShell sections={sections} title="AURA">
      {children}
    </AppShell>
  );
}
