"use client";

/* eslint-disable @next/next/no-img-element -- Room thumbnails are runtime catalogue upload URLs. */
import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Eye, ImageIcon, Plus, Search, Upload } from "lucide-react";
import { ROOM_TYPE_LABELS, RoomType, type Room } from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Badge } from "@cbs/ui/components/badge";
import { Input } from "@cbs/ui/components/input";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Combobox } from "@/components/combobox";
import { CatalogueImportDialog } from "@/components/catalogue-import-dialog";
import { useBuildings } from "@/lib/hooks/reference";
import { route } from "@/lib/route";
import { RoomFormDialog } from "./room-form-dialog";

const ALL = "ALL";

const ROOM_STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "UNDER_MAINTENANCE", label: "Under maintenance" },
];

export function RoomsClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Room | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState<string>(ALL);
  const [status, setStatus] = React.useState<string>(ALL);
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

  const activate = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/api/v1/rooms/{id}/activate", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Room activated" });
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err) =>
      toast({
        variant: "destructive",
        title: "Couldn't activate",
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
            {row.original.status === "INACTIVE" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => activate.mutate(row.original.id)}
              >
                Activate
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [deactivate, activate],
  );

  const rooms = React.useMemo(() => query.data ?? [], [query.data]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (type !== ALL && r.room_type !== type) return false;
      if (status !== ALL && r.status !== status) return false;
      if (needle) {
        const hay =
          `${r.name} ${r.room_code} ${r.building_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rooms, search, type, status]);

  const hasFilters = search.trim() !== "" || type !== ALL || status !== ALL;

  function clearFilters() {
    setSearch("");
    setType(ALL);
    setStatus(ALL);
  }

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code or building"
                aria-label="Search rooms"
                className="h-11 bg-[var(--color-card)] pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
              <Combobox
                value={type}
                onValueChange={setType}
                placeholder="Room type"
                searchPlaceholder="Search types…"
                emptyText="No types found."
                triggerClassName="h-11 w-full bg-[var(--color-card)] sm:w-44"
                options={[
                  { value: ALL, label: "All types" },
                  ...RoomType.options.map((t) => ({
                    value: t,
                    label: ROOM_TYPE_LABELS[t],
                  })),
                ]}
              />
              <Combobox
                value={status}
                onValueChange={setStatus}
                placeholder="Status"
                searchPlaceholder="Search statuses…"
                emptyText="No statuses found."
                triggerClassName="h-11 w-full bg-[var(--color-card)] sm:w-44"
                options={ROOM_STATUS_OPTIONS}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {filtered.length === 0
                ? "No rooms"
                : `${filtered.length} room${filtered.length === 1 ? "" : "s"}`}
              {hasFilters ? " match your filters" : ""}
            </p>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            caption="University rooms"
            emptyTitle={hasFilters ? "No rooms match" : undefined}
            emptyDescription={
              hasFilters
                ? "Try a different search term, room type, or status."
                : undefined
            }
            emptyActions={
              hasFilters ? (
                <Button type="button" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
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
