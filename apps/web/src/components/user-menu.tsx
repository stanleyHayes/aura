"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  LogOut,
  Map,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { ROLE_LABELS } from "@cbs/schemas";
import {
  Avatar,
  AvatarFallback,
} from "@cbs/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cbs/ui/components/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { dispatchReplayTour } from "@/components/app-tour";
import { logoutAction } from "@/app/actions/auth";
import { route } from "@/lib/route";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function MenuRow({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-[var(--color-foreground)]">
          {title}
        </span>
        <span className="text-xs leading-4 text-[var(--color-muted-foreground)]">
          {description}
        </span>
      </span>
    </>
  );
}

export function UserMenu() {
  const { user } = useSession();
  const pathname = usePathname();
  if (!user) return null;
  const accountBase = pathname.startsWith("/admin") ? "/admin" : "/app";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          aria-label="Account menu"
        >
          <Avatar>
            <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {user.full_name}
          </p>
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">
            {user.email}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {ROLE_LABELS[user.role]}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="items-start gap-3 p-3">
          <Link href={route(`${accountBase}/profile`)}>
            <MenuRow
              icon={UserIcon}
              title="Profile"
              description="View your account details"
            />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="items-start gap-3 p-3">
          <Link href={route(`${accountBase}/settings`)}>
            <MenuRow
              icon={Settings}
              title="Settings"
              description="Preferences, notifications, and security"
            />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="items-start gap-3 p-3">
          <Link href={route(`${accountBase}/guide`)}>
            <MenuRow
              icon={BookOpen}
              title="User guide"
              description="Open the complete AURA guide"
            />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="items-start gap-3 p-3"
          onSelect={dispatchReplayTour}
        >
          <MenuRow
            icon={Map}
            title="Replay tour"
            description="Play the first-login dashboard tour"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild className="items-start gap-3 p-3">
            <button type="submit" className="w-full text-left">
              <MenuRow
                icon={LogOut}
                title="Sign out"
                description="End your session on this device"
              />
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
