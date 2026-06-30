"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarCog,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  Menu,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  Ticket,
  Upload,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@cbs/ui/lib/cn";
import { Button } from "@cbs/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cbs/ui/components/sheet";
import { Brand } from "@/components/brand";
import { AppTour } from "@/components/app-tour";
import { NotificationsBell } from "@/components/notifications-bell";
import { useSession } from "@/components/session-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { route } from "@/lib/route";
import type { AppSession } from "@/lib/session-types";

/**
 * Icon registry. Server layouts pass a string key (functions cannot cross the
 * server→client boundary), and we resolve it to a Lucide component here.
 */
const ICONS = {
  bell: Bell,
  "book-open": BookOpen,
  building: Building2,
  "calendar-cog": CalendarCog,
  calendar: CalendarDays,
  "clipboard-check": ClipboardCheck,
  door: DoorOpen,
  "file-bar-chart": FileBarChart,
  "graduation-cap": GraduationCap,
  dashboard: LayoutDashboard,
  "scroll-text": ScrollText,
  search: Search,
  settings: SettingsIcon,
  ticket: Ticket,
  upload: Upload,
  user: UserRound,
  users: Users,
  wrench: Wrench,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  /** Optional exact-match flag for index routes. */
  exact?: boolean;
}

export interface NavSection {
  heading?: string;
  icon?: IconKey;
  items: NavItem[];
}

const SIDEBAR_STORAGE = "aura-sidebar-collapsed";
const GROUP_STORAGE = "aura-nav-groups";

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function groupId(section: NavSection, index: number): string {
  return section.heading ?? section.items[0]?.href ?? `section-${index}`;
}

function NavList({
  sections,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  sections: NavSection[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const raw = window.localStorage.getItem(GROUP_STORAGE);
        return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        return {};
      }
    }
  );

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = { ...current, [id]: !(current[id] ?? true) };
      window.localStorage.setItem(GROUP_STORAGE, JSON.stringify(next));
      return next;
    });
  }

  if (collapsed) {
    return (
      <nav aria-label="Sections" className="flex flex-col items-center gap-2">
        {sections.flatMap((section) =>
          section.items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={route(item.href)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={cn(
                  "relative grid size-11 place-items-center rounded-xl transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                  active
                    ? "bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]"
                    : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-2 h-7 w-1 rounded-r-full bg-[var(--color-maroon)]" />
                ) : null}
                <Icon className="size-5" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          }),
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Sections" className="flex flex-col gap-3">
      {sections.map((section, index) => {
        const id = groupId(section, index);
        const hasActiveItem = section.items.some((item) =>
          isActive(pathname, item),
        );
        const open = hasActiveItem || (openGroups[id] ?? true);
        const panelId = `nav-group-${index}`;
        return (
          <div key={id} className="rounded-xl border border-transparent">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggleGroup(id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {section.icon ? (
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
                    {React.createElement(ICONS[section.icon], {
                      className: "size-3.5",
                      "aria-hidden": true,
                    })}
                  </span>
                ) : null}
                <span className="truncate">{section.heading ?? "Navigation"}</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  !open && "-rotate-90",
                )}
                aria-hidden="true"
              />
            </button>
            <div
              id={panelId}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mt-1 flex flex-col">
                  {section.items.map((item, itemIndex) => {
                    const active = isActive(pathname, item);
                    const Icon = ICONS[item.icon];
                    return (
                      <div key={item.href} className="relative min-h-10 pl-6">
                        <svg
                          viewBox="0 0 24 40"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          className={cn(
                            "absolute left-1 top-0 h-full w-5 text-[var(--color-border)] transition-colors",
                            active && "text-[var(--color-maroon)]",
                          )}
                        >
                          {itemIndex === section.items.length - 1 ? (
                            <path
                              d="M7 0 V17 Q7 23 13 23 H24"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeWidth="1.5"
                            />
                          ) : (
                            <path
                              d="M7 0 V40 M7 23 Q7 23 13 23 H24"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeWidth="1.5"
                            />
                          )}
                        </svg>
                        <Link
                          href={route(item.href)}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                            active
                              ? "bg-[var(--color-maroon-tint)] text-[var(--color-maroon)] shadow-sm"
                              : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                          )}
                        >
                          {active ? (
                            <span className="absolute left-0 top-2 h-6 w-1 rounded-r-full bg-[var(--color-maroon)]" />
                          ) : null}
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          {item.label}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  sections,
  title,
  session,
  children,
}: {
  sections: NavSection[];
  title: string;
  session?: AppSession | null;
  children: React.ReactNode;
}) {
  const { user: hydratedUser } = useSession();
  const user = hydratedUser ?? session?.user ?? null;
  const pathname = usePathname();
  const activeItem = sections
    .flatMap((section) => section.items)
    .find((item) => isActive(pathname, item));
  const topbarTitle = activeItem?.label ?? title;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE) === "true";
  });

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE, String(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-dvh bg-[var(--color-background)]">
      {/* Desktop sidebar */}
      <aside
        data-tour="desktop-navigation"
        className={cn(
          "hidden h-dvh max-h-dvh shrink-0 flex-col self-start border-r border-[var(--color-border)] bg-[var(--color-card)] transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:flex",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4",
            collapsed && "px-2",
          )}
        >
          <Link href="/" aria-label="AURA home">
            <Brand withText={!collapsed} />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={toggleSidebar}
            className={cn("hidden lg:inline-flex", collapsed && "size-8")}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        </div>
        <div className={cn("flex-1 overflow-y-auto", collapsed ? "p-3" : "p-4")}>
          <NavList
            sections={sections}
            pathname={pathname}
            collapsed={collapsed}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  data-tour="mobile-navigation"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex h-dvh max-h-dvh w-72 flex-col gap-0 overflow-hidden p-0"
              >
                <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-4 pr-12">
                  <SheetHeader>
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <Brand />
                  </SheetHeader>
                </div>
                <div
                  data-testid="app-mobile-nav-scroll"
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable]"
                >
                  <NavList
                    sections={sections}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-serif text-lg font-semibold tracking-tight">
              {topbarTitle}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span data-tour="theme-toggle" className="inline-flex">
              <ThemeToggle />
            </span>
            <span data-tour="notifications" className="inline-flex">
              <NotificationsBell />
            </span>
            <span data-tour="user-menu" className="inline-flex">
              <UserMenu fallbackUser={user} />
            </span>
          </div>
        </header>

        <main
          id="main"
          data-tour="main-content"
          className="flex-1 p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
      <AppTour
        userId={user?.id}
        mode={pathname.startsWith("/admin") ? "admin" : "app"}
        autoStart={pathname.startsWith("/admin") || pathname.startsWith("/app")}
      />
    </div>
  );
}
