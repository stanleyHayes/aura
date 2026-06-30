"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cbs/ui/components/dialog";
import { useToast } from "@cbs/ui/components/toast";
import { ImagePicker } from "@/components/forms/image-picker";
import { ProblemAlert } from "@/components/problem-alert";
import { uploadCatalogueImages } from "@/lib/api/multipart";

type CatalogueImageKind = "room" | "building" | "equipment";

const KIND_COPY: Record<
  CatalogueImageKind,
  { label: string; path: (id: string) => string }
> = {
  room: {
    label: "Room",
    path: (id) => `/api/v1/rooms/${id}/images`,
  },
  building: {
    label: "Building",
    path: (id) => `/api/v1/buildings/${id}/images`,
  },
  equipment: {
    label: "Equipment",
    path: (id) => `/api/v1/equipment/${id}/images`,
  },
};

export function CatalogueImageUploader({
  kind,
  entityId,
  entityName,
  existingMainUrl,
  existingGalleryUrls = [],
}: {
  kind: CatalogueImageKind;
  entityId: string;
  entityName: string;
  existingMainUrl?: string | null;
  existingGalleryUrls?: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [mainFile, setMainFile] = React.useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<unknown>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const copy = KIND_COPY[kind];
  const hasFiles = mainFile !== null || galleryFiles.length > 0;

  function reset() {
    setMainFile(null);
    setGalleryFiles([]);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasFiles || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadCatalogueImages({
        path: copy.path(entityId),
        main: mainFile,
        gallery: galleryFiles,
      });
      toast({
        variant: "success",
        title: `${copy.label} images updated`,
        description: entityName,
      });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ImagePlus className="size-4" aria-hidden="true" />
        Add images
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) reset();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{copy.label} images</DialogTitle>
            <DialogDescription>{entityName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error ? <ProblemAlert error={error} /> : null}
            <ImagePicker
              title={`${copy.label} media`}
              existingMainUrl={existingMainUrl}
              existingGalleryUrls={existingGalleryUrls}
              mainFile={mainFile}
              galleryFiles={galleryFiles}
              onMainFileChange={setMainFile}
              onGalleryFilesChange={setGalleryFiles}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!hasFiles}
                loading={submitting}
                loadingLabel="Uploading images"
              >
                Upload images
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
