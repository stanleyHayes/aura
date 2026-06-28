"use client";

import { LogOut, User as UserIcon } from "lucide-react";
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
import { logoutAction } from "@/app/actions/auth";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const { user } = useSession();
  if (!user) return null;

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
      <DropdownMenuContent align="end" className="w-56">
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
        <DropdownMenuItem disabled>
          <UserIcon className="size-4" /> Profile (coming soon)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <button
            type="submit"
            className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[var(--color-accent)]"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
