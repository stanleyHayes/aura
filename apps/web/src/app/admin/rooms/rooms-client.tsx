"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Eye, ImageIcon, Plus, Upload } from "lucide-react";
import { ROOM_TYPE_LABELS, type Room } from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Badge } from "@cbs/ui/components/badge";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { CatalogueImportDialog } from "@/components/catalogue-import-dialog";
import { useBuildings } from "@/lib/hooks/reference";
import { route } from "@/lib/route";
import { RoomFormDialog } from "./room-form-dialog";

export function RoomsClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Room | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const buildings = useBuildings();

  const query = useQuery({
    queryKey: qk.rooms({ admin: true }),
    queryFn: async (): Promise<Room[]> => {
      const page = unwrap(
        await api.GET("/api/v1/rooms", { params: { query: { limit: 500 } } }),
      );
      return page.data as Room[];
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/api/v1/rooms/{id}/deactivate", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Room deactivated" });
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err) =>
      toast({
        variant: "destructive",
        title: "Couldn't deactivate",
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const columns: ColumnDef<Room>[] = React.useMemo(
    () => [
      {
        id: "image",
        header: "Image",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.image_url ? (
            <img
              src={row.original.image_url}
              alt={`${row.original.name} room`}
              className="size-12 rounded-lg border border-[var(--color-border)] object-cover"
            />
          ) : (
            <span className="grid size-12 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
              <ImageIcon className="size-5" aria-hidden="true" />
            </span>
          ),
      },
      {
        accessorKey: "room_code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.room_code}</span>
        ),
      },
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "building_name",
        header: "Building",
        cell: ({ row }) => row.original.building_name ?? "—",
      },
      {
        accessorKey: "room_type",
        header: "Type",
        cell: ({ row }) => ROOM_TYPE_LABELS[row.original.room_type],
      },
      { accessorKey: "capacity", header: "Capacity" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "ACTIVE" ? "approved" : "cancelled"}
          >
            {row.original.status.replace(/_/g, " ").toLowerCase()}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={route(`/admin/rooms/${row.original.id}`)}>
                <Eye className="size-4" aria-hidden="true" />
                View
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(row.original)}
            >
              Edit
            </Button>
            {row.original.status === "ACTIVE" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deactivate.mutate(row.original.id)}
              >
                Deactivate
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [deactivate],
  );

  return (
    <>
      <PageHeader
        icon={DoorOpen}
        title="Rooms"
        description="Manage the bookable room catalogue, capacity, type and equipment."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New room
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          caption="University rooms"
        />
      )}

      <RoomFormDialog
        open={creating}
        room={null}
        onOpenChange={setCreating}
      />
      <RoomFormDialog
        open={editing !== null}
        room={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <CatalogueImportDialog
        kind="rooms"
        open={importOpen}
        onOpenChange={setImportOpen}
        buildings={buildings.data ?? []}
        rooms={query.data ?? []}
        onImported={() => void queryClient.invalidateQueries({ queryKey: ["rooms"] })}
      />
    </>
  );
}
