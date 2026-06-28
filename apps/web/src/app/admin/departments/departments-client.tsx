"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  DepartmentForm as Schema,
  type DepartmentForm as Values,
  type Department,
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
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Field } from "@/components/forms/field";

export function DepartmentsClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Department | null>(null);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const query = useQuery({
    queryKey: qk.departments,
    queryFn: async (): Promise<Department[]> => {
      const page = unwrap(
        await api.GET("/api/v1/departments", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as Department[];
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: editing
      ? { code: editing.code, name: editing.name, faculty: editing.faculty ?? "" }
      : { code: "", name: "", faculty: "" },
  });

  const save = useMutation({
    mutationFn: async (values: Values) =>
      editing
        ? unwrap(
            await api.PATCH("/api/v1/departments/{id}", {
              params: { path: { id: editing.id } },
              body: values as never,
            }),
          )
        : unwrap(await api.POST("/api/v1/departments", { body: values as never })),
    onSuccess: () => {
      toast({ variant: "success", title: editing ? "Department updated" : "Department created" });
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
      close();
    },
    onError: (err) => setError(err),
  });

  function close() {
    setOpen(false);
    setEditing(null);
    setError(null);
  }

  const columns: ColumnDef<Department>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "faculty",
      header: "Faculty",
      cell: ({ row }) => row.original.faculty ?? "—",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setOpen(true);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Departments"
        description="Academic departments that users and courses belong to."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New department
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} caption="Departments" />
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit department" : "New department"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => {
              setError(null);
              save.mutate(v);
            })}
            className="flex flex-col gap-4"
            noValidate
          >
            {error ? <ProblemAlert error={error} /> : null}
            <div className="grid grid-cols-2 gap-3">
              <Field id="d-code" label="Code" error={form.formState.errors.code?.message} required>
                {(p) => <Input {...p} {...form.register("code")} />}
              </Field>
              <Field id="d-faculty" label="Faculty">
                {(p) => <Input {...p} {...form.register("faculty")} />}
              </Field>
            </div>
            <Field id="d-name" label="Name" error={form.formState.errors.name?.message} required>
              {(p) => <Input {...p} {...form.register("name")} />}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
