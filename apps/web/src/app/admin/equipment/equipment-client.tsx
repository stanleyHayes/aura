"use client";

/* eslint-disable @next/next/no-img-element -- Equipment thumbnails are runtime catalogue upload URLs. */
import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ImageIcon, Plus, Search, Upload, Wrench } from "lucide-react";
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
import { ImagePicker } from "@/components/forms/image-picker";
import { CatalogueImportDialog } from "@/components/catalogue-import-dialog";
import { uploadCatalogueImages } from "@/lib/api/multipart";
import { route } from "@/lib/route";

export function EquipmentClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Equipment | null>(null);
  const [open, setOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [mainImage, setMainImage] = React.useState<File | null>(null);
  const [galleryImages, setGalleryImages] = React.useState<File[]>([]);
  const [error, setError] = React.useState<unknown>(null);
  const [search, setSearch] = React.useState("");

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
    mutationFn: async (values: Values) => {
      const equipment = (editing
        ? unwrap(
            await api.PATCH("/api/v1/equipment/{id}", {
              params: { path: { id: editing.id } },
              body: values as never,
            }),
          )
        : unwrap(
            await api.POST("/api/v1/equipment", { body: values as never }),
          )) as Equipment;

      if (mainImage || galleryImages.length > 0) {
        return uploadCatalogueImages<Equipment>({
          path: `/api/v1/equipment/${equipment.id}/images`,
          main: mainImage,
          gallery: galleryImages,
        });
      }
      return equipment;
    },
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
    setMainImage(null);
    setGalleryImages([]);
    setError(null);
  }

  const columns: ColumnDef<Equipment>[] = [
    {
      id: "image",
      header: "Image",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.image_url ? (
          <img
            src={row.original.image_url}
            alt={`${row.original.name} equipment`}
            className="size-12 rounded-lg border border-[var(--color-border)] object-cover"
          />
        ) : (
          <span className="grid size-12 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <ImageIcon className="size-5" aria-hidden="true" />
          </span>
        ),
    },
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={route(`/admin/equipment/${row.original.id}`)}>
              <Eye className="size-4" aria-hidden="true" />
              View
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setMainImage(null);
              setGalleryImages([]);
              setOpen(true);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const equipment = React.useMemo(() => query.data ?? [], [query.data]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return equipment;
    return equipment.filter((e) =>
      `${e.name} ${e.code}`.toLowerCase().includes(needle),
    );
  }, [equipment, search]);

  const hasFilters = search.trim() !== "";

  return (
    <>
      <PageHeader
        icon={Wrench}
        title="Equipment"
        description="Equipment types that rooms can be fitted with (projector, smart board, audio, and so on)."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setMainImage(null);
                setGalleryImages([]);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New equipment
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or code"
                aria-label="Search equipment"
                className="h-11 bg-[var(--color-card)] pl-9"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {filtered.length === 0
                ? "No equipment"
                : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
              {hasFilters ? " match your search" : ""}
            </p>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                Clear filters
              </Button>
            ) : null}
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            caption="Equipment"
            emptyTitle={hasFilters ? "No equipment matches" : undefined}
            emptyDescription={
              hasFilters ? "Try a different search term." : undefined
            }
            emptyActions={
              hasFilters ? (
                <Button type="button" onClick={() => setSearch("")}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-2xl">
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
            <ImagePicker
              title="Equipment images"
              existingMainUrl={editing?.image_url}
              existingGalleryUrls={editing?.gallery_urls ?? []}
              mainFile={mainImage}
              galleryFiles={galleryImages}
              onMainFileChange={setMainImage}
              onGalleryFilesChange={setGalleryImages}
            />
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

      <CatalogueImportDialog
        kind="equipment"
        open={importOpen}
        onOpenChange={setImportOpen}
        equipment={query.data ?? []}
        onImported={() => void queryClient.invalidateQueries({ queryKey: qk.equipment })}
      />
    </>
  );
}
