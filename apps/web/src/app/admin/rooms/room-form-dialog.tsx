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
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

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
      if (room) {
        return unwrap(
          await api.PATCH("/api/v1/rooms/{id}", {
            params: { path: { id: room.id } },
            body: values as never,
          }),
        );
      }
      return unwrap(
        await api.POST("/api/v1/rooms", { body: values as never }),
      );
    },
    onSuccess: () => {
      toast({ variant: "success", title: room ? "Room updated" : "Room created" });
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
      onOpenChange(false);
    },
    onError: (err) => setError(err),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
              <Select
                value={form.watch("building_id")}
                onValueChange={(v) => form.setValue("building_id", v)}
              >
                <SelectTrigger id={p.id} aria-invalid={p["aria-invalid"]}>
                  <SelectValue placeholder="Choose a building" />
                </SelectTrigger>
                <SelectContent>
                  {(buildings.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
