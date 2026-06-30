"use client";

/* eslint-disable @next/next/no-img-element -- Room thumbnails are runtime catalogue upload URLs. */
import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Plus, Wrench } from "lucide-react";
import {
  MaintenanceWindowForm as Schema,
  type MaintenanceWindowForm as Values,
  type MaintenanceWindow,
  type Room,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Skeleton } from "@cbs/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cbs/ui/components/dialog";
import { useToast } from "@cbs/ui/components/toast";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { localToRfc3339 } from "@/lib/intervals";
import { env } from "@/lib/env";
import { Combobox } from "@/components/combobox";
import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Field } from "@/components/forms/field";
import { route } from "@/lib/route";

function RoomProfileLink({
  roomId,
  room,
}: {
  roomId: string;
  room?: Room | null;
}) {
  const title = room?.name ?? "Room profile";
  const detail = room
    ? [room.room_code, room.building_name].filter(Boolean).join(" - ")
    : "Open room detail";

  return (
    <Link
      href={route(`/admin/rooms/${roomId}`)}
      className="group/room inline-flex min-w-64 items-center gap-3 rounded-xl p-1 pr-3 transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
    >
      {room?.image_url ? (
        <img
          src={room.image_url}
          alt={`${room.name} room`}
          className="size-12 shrink-0 rounded-xl border border-[var(--color-border)] object-cover"
        />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] transition-colors group-hover/room:text-[var(--color-maroon)]">
          <DoorOpen className="size-5" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[var(--color-foreground)] group-hover/room:text-[var(--color-maroon)]">
          {title}
        </span>
        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
          {detail || "Open room detail"}
        </span>
      </span>
    </Link>
  );
}

export function MaintenanceClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const query = useQuery({
    queryKey: qk.maintenance(),
    queryFn: async (): Promise<MaintenanceWindow[]> => {
      const page = unwrap(
        await api.GET("/api/v1/maintenance-windows", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as MaintenanceWindow[];
    },
  });

  const rooms = useQuery({
    queryKey: qk.rooms({ forMaintenance: true }),
    queryFn: async (): Promise<Room[]> => {
      const page = unwrap(
        await api.GET("/api/v1/rooms", { params: { query: { limit: 500 } } }),
      );
      return page.data as Room[];
    },
  });
  const roomById = React.useMemo(() => {
    return new Map((rooms.data ?? []).map((room) => [room.id, room]));
  }, [rooms.data]);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { room_id: "", date: "", start: "", end: "", reason: "" },
  });
  const selectedRoomId = useWatch({
    control: form.control,
    name: "room_id",
  });
  const dateValue = useWatch({ control: form.control, name: "date" });
  const startValue = useWatch({ control: form.control, name: "start" });
  const endValue = useWatch({ control: form.control, name: "end" });

  const create = useMutation({
    mutationFn: async (values: Values) =>
      unwrap(
        await api.POST("/api/v1/maintenance-windows", {
          body: {
            room_id: values.room_id,
            // Endpoint expects RFC 3339 instants (institution TZ).
            starts_at: localToRfc3339(values.date, values.start, env.appTz),
            ends_at: localToRfc3339(values.date, values.end, env.appTz),
            reason: values.reason,
          } as never,
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Maintenance window created" });
      void queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => setError(err),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/api/v1/maintenance-windows/{id}", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });

  const columns: ColumnDef<MaintenanceWindow>[] = [
    {
      id: "room",
      header: "Room",
      accessorFn: (row) =>
        row.room?.name ??
        roomById.get(row.room_id)?.name ??
        roomById.get(row.room_id)?.room_code ??
        "",
      cell: ({ row }) => (
        <RoomProfileLink
          roomId={row.original.room_id}
          room={row.original.room ?? roomById.get(row.original.room_id)}
        />
      ),
    },
    {
      accessorKey: "starts_at",
      header: "When",
      cell: ({ row }) => (
        <div>
          <p>{formatDate(row.original.starts_at)}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {formatTimeRange(row.original.starts_at, row.original.ends_at)}
          </p>
        </div>
      ),
    },
    { accessorKey: "reason", header: "Reason" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate(row.original.id)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Wrench}
        title="Maintenance windows"
        description="Block rooms for maintenance. Blocked periods never appear as available and cannot be booked."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New window
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          caption="Maintenance windows"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New maintenance window</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => {
              setError(null);
              create.mutate(v);
            })}
            className="flex flex-col gap-4"
            noValidate
          >
            {error ? <ProblemAlert error={error} /> : null}
            <Field
              id="m-room"
              label="Room"
              error={form.formState.errors.room_id?.message}
              required
            >
              {(p) => (
                <Combobox
                  id={p.id}
                  value={selectedRoomId}
                  onValueChange={(v) => form.setValue("room_id", v)}
                  placeholder="Choose a room"
                  searchPlaceholder="Search rooms…"
                  emptyText="No rooms found."
                  options={(rooms.data ?? []).map((r) => ({
                    value: r.id,
                    label: r.name,
                    description: [r.room_code, r.building_name]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                />
              )}
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="m-date" label="Date" error={form.formState.errors.date?.message}>
                {(p) => (
                  <DatePicker
                    id={p.id}
                    value={dateValue}
                    onChange={(v) =>
                      form.setValue("date", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )}
              </Field>
              <Field id="m-start" label="From" error={form.formState.errors.start?.message}>
                {(p) => (
                  <TimePicker
                    id={p.id}
                    step={15}
                    value={startValue}
                    onChange={(v) =>
                      form.setValue("start", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )}
              </Field>
              <Field id="m-end" label="To" error={form.formState.errors.end?.message}>
                {(p) => (
                  <TimePicker
                    id={p.id}
                    step={15}
                    value={endValue}
                    onChange={(v) =>
                      form.setValue("end", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )}
              </Field>
            </div>
            <Field
              id="m-reason"
              label="Reason"
              error={form.formState.errors.reason?.message}
              required
            >
              {(p) => (
                <Input {...p} placeholder="e.g. Projector replacement" {...form.register("reason")} />
              )}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
