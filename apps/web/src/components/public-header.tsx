"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@cbs/ui/components/button";
import { useSession } from "@/components/session-provider";
import { defaultLandingPath } from "@/lib/auth";
import { route } from "@/lib/route";

/** Public site header. Renders auth-aware CTA on the client so the surrounding
 *  page stays statically renderable for SEO (§12.1). */
export function PublicHeader() {
  const { session } = useSession();
  const dashboardHref = route(
    session ? defaultLandingPath(session.user.role) : "/login",
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="AURA home">
          <Brand />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rooms">Room directory</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={dashboardHref}>
              {session ? "Open dashboard" : "Sign in"}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
