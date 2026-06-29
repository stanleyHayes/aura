"use client";

import { Bell, BellOff } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { cn } from "@cbs/ui/lib/cn";
import { formatRelative } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProblemAlert } from "@/components/problem-alert";

export function NotificationsClient() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.notifications({ all: true }),
    queryFn: async (): Promise<Notification[]> => {
      const page = unwrap(
        await api.GET("/api/v1/notifications", {
          params: { query: { limit: 100 } },
        }),
      );
      return page.data as Notification[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/api/v1/notifications/{id}/read", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/notifications/read-all")),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = query.data ?? [];

  return (
    <>
      <PageHeader
        icon={Bell}
        title="Notifications"
        actions={
          items.some((n) => !n.read_at) ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications"
          description="Booking updates and reminders will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card
                className={cn(
                  !n.read_at && "border-l-4 border-l-[var(--color-ink-500)]",
                )}
              >
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                      {n.body}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {formatRelative(n.created_at)}
                    </p>
                  </div>
                  {!n.read_at ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
