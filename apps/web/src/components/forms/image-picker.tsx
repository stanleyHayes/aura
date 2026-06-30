"use client";

import * as React from "react";
import { ImagePlus, Images, X } from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { cn } from "@cbs/ui/lib/cn";

function usePreviewUrls(files: File[]) {
  const urls = React.useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  React.useEffect(() => {
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [urls]);
  return urls;
}

function Thumbnail({
  src,
  label,
  onRemove,
  className,
}: {
  src: string;
  label: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "group relative block overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]",
        className,
      )}
    >
      <img src={src} alt={label} className="h-full w-full object-cover" />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-md bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm"
          aria-label={`Remove ${label}`}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </span>
  );
}

export function ImagePicker({
  title,
  existingMainUrl,
  existingGalleryUrls = [],
  mainFile,
  galleryFiles,
  onMainFileChange,
  onGalleryFilesChange,
}: {
  title: string;
  existingMainUrl?: string | null;
  existingGalleryUrls?: string[];
  mainFile: File | null;
  galleryFiles: File[];
  onMainFileChange: (file: File | null) => void;
  onGalleryFilesChange: (files: File[]) => void;
}) {
  const id = React.useId();
  const mainUrl = usePreviewUrls(mainFile ? [mainFile] : [])[0] ?? existingMainUrl;
  const galleryUrls = usePreviewUrls(galleryFiles);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_28%,transparent)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--color-foreground)]">{title}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Main image and gallery are uploaded from this device.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <label htmlFor={`${id}-main`}>
              <ImagePlus className="size-4" /> Main image
            </label>
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <label htmlFor={`${id}-gallery`}>
              <Images className="size-4" /> Gallery
            </label>
          </Button>
        </div>
      </div>

      <input
        id={`${id}-main`}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => onMainFileChange(event.target.files?.[0] ?? null)}
      />
      <input
        id={`${id}-gallery`}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) =>
          onGalleryFilesChange([
            ...galleryFiles,
            ...Array.from(event.target.files ?? []),
          ])
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
        {mainUrl ? (
          <Thumbnail
            src={mainUrl}
            label={`${title} main image`}
            onRemove={mainFile ? () => onMainFileChange(null) : undefined}
            className="aspect-[4/3]"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)]">
            <ImagePlus className="size-7" aria-hidden="true" />
          </div>
        )}

        <div className="grid min-h-24 grid-cols-3 gap-2 sm:grid-cols-4">
          {existingGalleryUrls.map((url, index) => (
            <Thumbnail
              key={`${url}-${index}`}
              src={url}
              label={`${title} gallery image ${index + 1}`}
              className="aspect-square"
            />
          ))}
          {galleryUrls.map((url, index) => (
            <Thumbnail
              key={`${url}-${index}`}
              src={url}
              label={`${title} selected gallery image ${index + 1}`}
              onRemove={() =>
                onGalleryFilesChange(galleryFiles.filter((_, i) => i !== index))
              }
              className="aspect-square"
            />
          ))}
          {existingGalleryUrls.length === 0 && galleryUrls.length === 0 ? (
            <div className="col-span-full grid min-h-24 place-items-center rounded-lg border border-dashed border-[var(--color-border)] px-4 text-center text-sm text-[var(--color-muted-foreground)]">
              No gallery images selected.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
