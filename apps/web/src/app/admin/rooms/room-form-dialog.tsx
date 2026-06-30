"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ROOM_TYPE_LABELS,
  RoomForm as Schema,
  RoomType,
  type RoomForm as Values,
  type Room,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
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
import { api, unwrap } from "@/lib/api/client";
import { useBuildings } from "@/lib/hooks/reference";
import { Combobox } from "@/components/combobox";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";
import { ImagePicker } from "@/components/forms/image-picker";
import { uploadCatalogueImages } from "@/lib/api/multipart";

export function RoomFormDialog({
  open,
  room,
  onOpenChange,
}: {
  open: boolean;
  room: Room | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const buildings = useBuildings();
  const [error, setError] = React.useState<unknown>(null);
  const [mainImage, setMainImage] = React.useState<File | null>(null);
  const [galleryImages, setGalleryImages] = React.useState<File[]>([]);

  React.useEffect(() => {
    if (open) {
      setMainImage(null);
      setGalleryImages([]);
      setError(null);
    }
  }, [open, room?.id]);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: room
      ? {
          room_code: room.room_code,
          name: room.name,
          building_id: room.building_id,
          capacity: room.capacity,
          room_type: room.room_type,
          status: room.status === "UNDER_MAINTENANCE" ? "ACTIVE" : room.status,
        }
      : {
          room_code: "",
          name: "",
          building_id: "",
          capacity: 1,
          room_type: "LECTURE_HALL",
          status: "ACTIVE",
        },
  });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const saved = (room
        ? unwrap(
          await api.PATCH("/api/v1/rooms/{id}", {
            params: { path: { id: room.id } },
            body: values as never,
          }),
        )
        : unwrap(
            await api.POST("/api/v1/rooms", { body: values as never }),
          )) as Room;

      if (mainImage || galleryImages.length > 0) {
        return uploadCatalogueImages<Room>({
          path: `/api/v1/rooms/${saved.id}/images`,
          main: mainImage,
          gallery: galleryImages,
        });
      }
      return saved;
    },
    onSuccess: () => {
      toast({ variant: "success", title: room ? "Room updated" : "Room created" });
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setMainImage(null);
      setGalleryImages([]);
      onOpenChange(false);
    },
    onError: (err) => setError(err),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{room ? "Edit room" : "New room"}</DialogTitle>
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
            <Field
              id="room_code"
              label="Room code"
              error={form.formState.errors.room_code?.message}
              required
            >
              {(p) => <Input {...p} {...form.register("room_code")} />}
            </Field>
            <Field
              id="capacity"
              label="Capacity"
              error={form.formState.errors.capacity?.message}
              required
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  {...form.register("capacity", { valueAsNumber: true })}
                />
              )}
            </Field>
          </div>

          <Field
            id="name"
            label="Name"
            error={form.formState.errors.name?.message}
            required
          >
            {(p) => <Input {...p} {...form.register("name")} />}
          </Field>

          <Field
            id="building_id"
            label="Building"
            error={form.formState.errors.building_id?.message}
            required
          >
            {(p) => (
              <Combobox
                id={p.id}
                value={form.watch("building_id")}
                onValueChange={(v) => form.setValue("building_id", v)}
                placeholder="Choose a building"
                searchPlaceholder="Search buildings…"
                emptyText="No buildings found."
                options={(buildings.data ?? []).map((b) => ({
                  value: b.id,
                  label: b.name,
                  description: b.code,
                }))}
              />
            )}
          </Field>

          <Field id="room_type" label="Room type">
            {(p) => (
              <Select
                value={form.watch("room_type")}
                onValueChange={(v) => form.setValue("room_type", v as RoomType)}
              >
                <SelectTrigger id={p.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RoomType.options.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROOM_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <ImagePicker
            title="Room images"
            existingMainUrl={room?.image_url}
            existingGalleryUrls={room?.gallery_urls ?? []}
            mainFile={mainImage}
            galleryFiles={galleryImages}
            onMainFileChange={setMainImage}
            onGalleryFilesChange={setGalleryImages}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
