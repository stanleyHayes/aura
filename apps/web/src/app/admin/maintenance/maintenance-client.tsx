"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import { useToast } from "@cbs/ui/components/toast";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { localToRfc3339 } from "@/lib/intervals";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Field } from "@/components/forms/field";

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

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { room_id: "", date: "", start: "", end: "", reason: "" },
  });

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
      accessorKey: "room",
      header: "Room",
      cell: ({ row }) => row.original.room?.name ?? row.original.room_id,
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
                <Select
                  value={form.watch("room_id")}
                  onValueChange={(v) => form.setValue("room_id", v)}
                >
                  <SelectTrigger id={p.id} aria-invalid={p["aria-invalid"]}>
                    <SelectValue placeholder="Choose a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rooms.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.room_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="m-date" label="Date" error={form.formState.errors.date?.message}>
                {(p) => <Input {...p} type="date" {...form.register("date")} />}
              </Field>
              <Field id="m-start" label="From" error={form.formState.errors.start?.message}>
                {(p) => <Input {...p} type="time" {...form.register("start")} />}
              </Field>
              <Field id="m-end" label="To" error={form.formState.errors.end?.message}>
                {(p) => <Input {...p} type="time" {...form.register("end")} />}
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
