"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Eye, ImageIcon, Plus, Upload } from "lucide-react";
import {
  BuildingForm as Schema,
  type BuildingForm as Values,
  type Building,
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

export function BuildingsClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Building | null>(null);
  const [open, setOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [mainImage, setMainImage] = React.useState<File | null>(null);
  const [galleryImages, setGalleryImages] = React.useState<File[]>([]);
  const [error, setError] = React.useState<unknown>(null);

  const query = useQuery({
    queryKey: qk.buildings,
    queryFn: async (): Promise<Building[]> => {
      const page = unwrap(
        await api.GET("/api/v1/buildings", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as Building[];
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: editing
      ? {
          code: editing.code,
          name: editing.name,
          campus: editing.campus ?? "",
        }
      : { code: "", name: "", campus: "" },
  });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const building = (editing
        ? unwrap(
            await api.PATCH("/api/v1/buildings/{id}", {
              params: { path: { id: editing.id } },
              body: values as never,
            }),
          )
        : unwrap(
            await api.POST("/api/v1/buildings", { body: values as never }),
          )) as Building;

      if (mainImage || galleryImages.length > 0) {
        return uploadCatalogueImages<Building>({
          path: `/api/v1/buildings/${building.id}/images`,
          main: mainImage,
          gallery: galleryImages,
        });
      }
      return building;
    },
    onSuccess: () => {
      toast({ variant: "success", title: editing ? "Building updated" : "Building created" });
      void queryClient.invalidateQueries({ queryKey: ["buildings"] });
      closeDialog();
    },
    onError: (err) => setError(err),
  });

  function openCreate() {
    setEditing(null);
    setMainImage(null);
    setGalleryImages([]);
    setOpen(true);
  }
  function openEdit(b: Building) {
    setEditing(b);
    setMainImage(null);
    setGalleryImages([]);
    setOpen(true);
  }
  function closeDialog() {
    setOpen(false);
    setEditing(null);
    setMainImage(null);
    setGalleryImages([]);
    setError(null);
  }

  const columns: ColumnDef<Building>[] = [
    {
      id: "image",
      header: "Image",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.image_url ? (
          <img
            src={row.original.image_url}
            alt={`${row.original.name} building`}
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
      accessorKey: "campus",
      header: "Campus",
      cell: ({ row }) => row.original.campus ?? "—",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={route(`/admin/buildings/${row.original.id}`)}>
              <Eye className="size-4" aria-hidden="true" />
              View
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Building2}
        title="Buildings"
        description="Campus buildings that contain bookable rooms."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New building
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} caption="Buildings" />
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit building" : "New building"}</DialogTitle>
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
              <Field id="b-code" label="Code" error={form.formState.errors.code?.message} required>
                {(p) => <Input {...p} {...form.register("code")} />}
              </Field>
              <Field id="b-campus" label="Campus">
                {(p) => <Input {...p} {...form.register("campus")} />}
              </Field>
            </div>
            <Field id="b-name" label="Name" error={form.formState.errors.name?.message} required>
              {(p) => <Input {...p} {...form.register("name")} />}
            </Field>
            <ImagePicker
              title="Building images"
              existingMainUrl={editing?.image_url}
              existingGalleryUrls={editing?.gallery_urls ?? []}
              mainFile={mainImage}
              galleryFiles={galleryImages}
              onMainFileChange={setMainImage}
              onGalleryFilesChange={setGalleryImages}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
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
        kind="buildings"
        open={importOpen}
        onOpenChange={setImportOpen}
        buildings={query.data ?? []}
        onImported={() => void queryClient.invalidateQueries({ queryKey: qk.buildings })}
      />
    </>
  );
}
