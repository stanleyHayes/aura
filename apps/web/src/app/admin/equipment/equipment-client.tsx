"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench } from "lucide-react";
import {
  EquipmentForm as Schema,
  type EquipmentForm as Values,
  type Equipment,
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

export function EquipmentClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Equipment | null>(null);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const query = useQuery({
    queryKey: qk.equipment,
    queryFn: async (): Promise<Equipment[]> => {
      const page = unwrap(
        await api.GET("/api/v1/equipment", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as Equipment[];
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: editing
      ? { code: editing.code, name: editing.name }
      : { code: "", name: "" },
  });

  const save = useMutation({
    mutationFn: async (values: Values) =>
      editing
        ? unwrap(
            await api.PATCH("/api/v1/equipment/{id}", {
              params: { path: { id: editing.id } },
              body: values as never,
            }),
          )
        : unwrap(await api.POST("/api/v1/equipment", { body: values as never })),
    onSuccess: () => {
      toast({ variant: "success", title: editing ? "Equipment updated" : "Equipment added" });
      void queryClient.invalidateQueries({ queryKey: ["equipment"] });
      close();
    },
    onError: (err) => setError(err),
  });

  function close() {
    setOpen(false);
    setEditing(null);
    setError(null);
  }

  const columns: ColumnDef<Equipment>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    { accessorKey: "name", header: "Name" },
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
        icon={Wrench}
        title="Equipment"
        description="Equipment types that rooms can be fitted with (projector, smart board, audio, and so on)."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New equipment
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} caption="Equipment" />
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit equipment" : "New equipment"}</DialogTitle>
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
            <Field id="e-code" label="Code" error={form.formState.errors.code?.message} required>
              {(p) => <Input {...p} placeholder="PROJECTOR" {...form.register("code")} />}
            </Field>
            <Field id="e-name" label="Name" error={form.formState.errors.name?.message} required>
              {(p) => <Input {...p} placeholder="Projector" {...form.register("name")} />}
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
