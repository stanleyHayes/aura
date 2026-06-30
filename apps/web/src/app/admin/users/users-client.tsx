"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import {
  ROLE_LABELS,
  UserForm as Schema,
  UserRole,
  type UserForm as Values,
  type User,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cbs/ui/components/dropdown-menu";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useDepartments } from "@/lib/hooks/reference";
import { Combobox } from "@/components/combobox";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Field } from "@/components/forms/field";

export function UsersClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const departments = useDepartments();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const query = useQuery({
    queryKey: qk.users({ admin: true }),
    queryFn: async (): Promise<User[]> => {
      const page = unwrap(
        await api.GET("/api/v1/users", { params: { query: { limit: 200 } } }),
      );
      return page.data as User[];
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { full_name: "", email: "", role: "REQUESTER", department_id: "" },
  });
  const selectedRole = useWatch({ control: form.control, name: "role" });
  const selectedDepartmentId = useWatch({
    control: form.control,
    name: "department_id",
  });

  const create = useMutation({
    mutationFn: async (values: Values) =>
      unwrap(
        await api.POST("/api/v1/users", {
          body: {
            ...values,
            department_id: values.department_id || null,
          } as never,
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "User invited" });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => setError(err),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) =>
      unwrap(
        await api.PATCH("/api/v1/users/{id}/role", {
          params: { path: { id } },
          body: { role },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Role updated" });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const lifecycle = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "suspend" | "reactivate" }) =>
      action === "suspend"
        ? unwrap(await api.POST("/api/v1/users/{id}/suspend", { params: { path: { id } } }))
        : unwrap(await api.POST("/api/v1/users/{id}/reactivate", { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "full_name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.full_name}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {row.original.email}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => ROLE_LABELS[row.original.role],
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => row.original.department?.name ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "ACTIVE" ? "approved" : "cancelled"}>
          {row.original.status.replace(/_/g, " ").toLowerCase()}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Change role</DropdownMenuLabel>
                {UserRole.options.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    disabled={r === u.role}
                    onSelect={() => changeRole.mutate({ id: u.id, role: r })}
                  >
                    {ROLE_LABELS[r]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {u.status === "ACTIVE" ? (
                  <DropdownMenuItem
                    onSelect={() => lifecycle.mutate({ id: u.id, action: "suspend" })}
                  >
                    Suspend account
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => lifecycle.mutate({ id: u.id, action: "reactivate" })}
                  >
                    Reactivate account
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        icon={Users}
        title="Users"
        description="Manage accounts, roles and access across the system."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Invite user
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} caption="Users" />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
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
              id="u-name"
              label="Full name"
              error={form.formState.errors.full_name?.message}
              required
            >
              {(p) => <Input {...p} {...form.register("full_name")} />}
            </Field>
            <Field
              id="u-email"
              label="Email"
              error={form.formState.errors.email?.message}
              required
            >
              {(p) => <Input {...p} type="email" {...form.register("email")} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="u-role" label="Role">
                {(p) => (
                  <Select
                    value={selectedRole}
                    onValueChange={(v) => form.setValue("role", v as UserRole)}
                  >
                    <SelectTrigger id={p.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UserRole.options.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field id="u-dept" label="Department">
                {(p) => (
                  <Combobox
                    id={p.id}
                    value={selectedDepartmentId || ""}
                    onValueChange={(v) => form.setValue("department_id", v)}
                    placeholder="None"
                    searchPlaceholder="Search departments…"
                    emptyText="No departments found."
                    options={[
                      { value: "", label: "None" },
                      ...(departments.data ?? []).map((d) => ({
                        value: d.id,
                        label: d.name,
                        description: d.code,
                      })),
                    ]}
                  />
                )}
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Inviting…" : "Invite user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
