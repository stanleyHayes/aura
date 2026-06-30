"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCog, Plus } from "lucide-react";
import {
  SemesterForm as Schema,
  type SemesterForm as Values,
  type Semester,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Badge } from "@cbs/ui/components/badge";
import { Skeleton } from "@cbs/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cbs/ui/components/dialog";
import { useToast } from "@cbs/ui/components/toast";
import { formatDate } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/date-picker";

export function SemestersClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const query = useQuery({
    queryKey: qk.semesters,
    queryFn: async (): Promise<Semester[]> => {
      const page = unwrap(
        await api.GET("/api/v1/semesters", {
          params: { query: { limit: 100 } },
        }),
      );
      return page.data as Semester[];
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", start_date: "", end_date: "", status: "DRAFT" },
  });
  const startDate = useWatch({ control: form.control, name: "start_date" });
  const endDate = useWatch({ control: form.control, name: "end_date" });

  const create = useMutation({
    mutationFn: async (values: Values) =>
      unwrap(await api.POST("/api/v1/semesters", { body: values as never })),
    onSuccess: () => {
      toast({ variant: "success", title: "Semester created" });
      void queryClient.invalidateQueries({ queryKey: ["semesters"] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => setError(err),
  });

  const transition = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "activate" | "archive" }) =>
      action === "activate"
        ? unwrap(await api.POST("/api/v1/semesters/{id}/activate", { params: { path: { id } } }))
        : unwrap(await api.POST("/api/v1/semesters/{id}/archive", { params: { path: { id } } })),
    onSuccess: (_d, vars) => {
      toast({
        variant: "success",
        title: vars.action === "activate" ? "Semester activated" : "Semester archived",
      });
      void queryClient.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (err) =>
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const columns: ColumnDef<Semester>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "start_date",
      header: "Start",
      cell: ({ row }) => formatDate(row.original.start_date),
    },
    {
      accessorKey: "end_date",
      header: "End",
      cell: ({ row }) => formatDate(row.original.end_date),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "ACTIVE"
              ? "approved"
              : row.original.status === "ARCHIVED"
                ? "cancelled"
                : "pending"
          }
        >
          {row.original.status.toLowerCase()}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex justify-end gap-2">
            {s.status === "DRAFT" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => transition.mutate({ id: s.id, action: "activate" })}
              >
                Activate
              </Button>
            ) : null}
            {s.status !== "ARCHIVED" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => transition.mutate({ id: s.id, action: "archive" })}
              >
                Archive
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        icon={CalendarCog}
        title="Semesters"
        description="Create semesters and set the active one. Only the active semester affects availability (BR2)."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New semester
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} caption="Semesters" />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New semester</DialogTitle>
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
              id="s-name"
              label="Name"
              error={form.formState.errors.name?.message}
              required
            >
              {(p) => (
                <Input {...p} placeholder="2026/27 Semester 1" {...form.register("name")} />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="s-start"
                label="Start date"
                error={form.formState.errors.start_date?.message}
                required
              >
                {(p) => (
                  <DatePicker
                    id={p.id}
                    value={startDate}
                    onChange={(v) =>
                      form.setValue("start_date", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )}
              </Field>
              <Field
                id="s-end"
                label="End date"
                error={form.formState.errors.end_date?.message}
                required
              >
                {(p) => (
                  <DatePicker
                    id={p.id}
                    align="end"
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(v) =>
                      form.setValue("end_date", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )}
              </Field>
            </div>
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
