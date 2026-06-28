"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
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
import { NotificationsBell } from "@/components/notifications-bell";
import { UserMenu } from "@/components/user-menu";
import { route } from "@/lib/route";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional exact-match flag for index routes. */
  exact?: boolean;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavList({
  sections,
  pathname,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <div key={section.heading ?? i} className="flex flex-col gap-1">
          {section.heading ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {section.heading}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={route(item.href)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                  active
                    ? "bg-[var(--color-ink-100)] text-[var(--color-ink-800)]"
                    : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  sections,
  title,
  children,
}: {
  sections: NavSection[];
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh bg-[var(--color-background)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] lg:flex">
        <div className="flex h-16 items-center border-b border-[var(--color-border)] px-5">
          <Link href="/" aria-label="Roomwise home">
            <Brand />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <NavList sections={sections} pathname={pathname} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader className="mb-6">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Brand />
                </SheetHeader>
                <NavList
                  sections={sections}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <h1 className="font-serif text-lg tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <main id="main" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
