"use client";

import Link from "next/link";
import {
  DoorOpen,
  Home,
  LayoutDashboard,
  LogIn,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@cbs/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cbs/ui/components/sheet";
import { useSession } from "@/components/session-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { defaultLandingPath } from "@/lib/auth";
import { route } from "@/lib/route";

interface PublicNavItem {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  cta?: boolean;
}

/** Public site header. Renders auth-aware CTA on the client so the surrounding
 *  page stays statically renderable for SEO (§12.1). */
export function PublicHeader() {
  const { session } = useSession();
  const dashboardHref = route(
    session ? defaultLandingPath(session.user.role) : "/login",
  );
  const dashboardLabel = session ? "Open dashboard" : "Sign in";
  const dashboardDescription = session
    ? "Return to your bookings, approvals and space tools."
    : "Use your Ashesi account to reserve classrooms and facilities.";
  const publicNavItems: PublicNavItem[] = [
    {
      href: "/",
      title: "Home",
      description: "AURA overview and core space-management benefits.",
      icon: Home,
    },
    {
      href: "/rooms",
      title: "Room directory",
      description: "Browse classrooms and campus facilities before signing in.",
      icon: DoorOpen,
    },
    {
      href: dashboardHref,
      title: dashboardLabel,
      description: dashboardDescription,
      icon: session ? LayoutDashboard : LogIn,
      cta: true,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="AURA home">
          <Brand />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rooms">Room directory</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={dashboardHref}>
              {dashboardLabel}
            </Link>
          </Button>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex h-dvh max-h-dvh w-[88vw] max-w-sm flex-col gap-0 overflow-hidden bg-[var(--color-card)] p-0"
            >
              <div className="border-b border-[var(--color-border)] bg-[var(--color-maroon)] px-5 py-6 text-[var(--color-paper-50)]">
                <SheetHeader className="gap-3 text-left">
                  <span className="inline-flex items-center gap-2">
                    <Brand withText={false} />
                    <span className="text-lg font-bold tracking-tight text-[var(--color-paper-50)]">
                      AURA
                    </span>
                  </span>
                  <div>
                    <SheetTitle className="text-xl text-[var(--color-paper-50)]">
                      AURA navigation
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-sm leading-6 text-[color-mix(in_oklch,var(--color-paper-50)_82%,transparent)]">
                      Reserve Ashesi classrooms and facilities with live
                      availability, approvals and conflict checks.
                    </SheetDescription>
                  </div>
                </SheetHeader>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 [scrollbar-gutter:stable]">
                <nav aria-label="Mobile primary" className="flex flex-col gap-2">
                  {publicNavItems.map(({ href, title, description, icon: Icon, cta }) => (
                    <SheetClose key={href} asChild>
                      <Link
                        href={route(href)}
                        className={
                          cta
                            ? "group flex items-start gap-3 rounded-xl bg-[var(--color-maroon)] p-4 text-[var(--color-paper-50)] shadow-sm transition-transform active:scale-[0.99]"
                            : "group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-[var(--color-foreground)] shadow-sm transition-colors hover:bg-[var(--color-accent)]"
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={
                            cta
                              ? "grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--color-paper-50)_18%,transparent)] text-[var(--color-paper-50)]"
                              : "grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]"
                          }
                        >
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {title}
                          </span>
                          <span
                            className={
                              cta
                                ? "mt-1 block text-xs leading-5 text-[color-mix(in_oklch,var(--color-paper-50)_80%,transparent)]"
                                : "mt-1 block text-xs leading-5 text-[var(--color-muted-foreground)]"
                            }
                          >
                            {description}
                          </span>
                        </span>
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                <div className="rounded-xl border border-dashed border-[color-mix(in_oklch,var(--color-maroon)_28%,var(--color-border))] bg-[var(--color-maroon-tint)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-maroon)]">
                    Smart Space Management for Ashesi
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-maroon-dark)]">
                    Live timetable awareness, transparent approvals and conflict
                    detection in one university booking workflow.
                  </p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
