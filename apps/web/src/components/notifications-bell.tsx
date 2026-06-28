"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";
import { Separator } from "@cbs/ui/components/separator";
import { formatRelative } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

/** Notifications bell with live SSE updates (§7.8, §10.3). */
export function NotificationsBell() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: qk.notifications({ unread: true }),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/notifications", {
          params: { query: { unread: true, limit: 20 } },
        }),
      ),
  });

  const notifications: Notification[] = data?.data ?? [];
  const unreadCount = notifications.length;

  // Live in-app stream via SSE (§7.8). Re-invalidate on each event.
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    const source = new EventSource("/api/v1/notifications/stream", {
      withCredentials: true,
    });
    const onMessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    source.addEventListener("notification", onMessage);
    source.onmessage = onMessage;
    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };
    return () => source.close();
  }, [queryClient]);

  async function markAllRead() {
    await api.POST("/api/v1/notifications/read-all");
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--color-destructive)] px-1 text-[10px] font-semibold leading-4 text-[var(--color-destructive-foreground)]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {notifications.map((n) => (
                <li key={n.id} className="p-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                    {n.body}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {formatRelative(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/app/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
