"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreateBookingForm as Schema,
  type CalendarBlock,
  type CreateBookingForm as Values,
  type Room,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Textarea } from "@cbs/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cbs/ui/components/dialog";
import { useToast } from "@cbs/ui/components/toast";
import { ROOM_TYPE_LABELS } from "@cbs/schemas";
import { api, unwrap } from "@/lib/api/client";
import { localToRfc3339, minutesOfDay } from "@/lib/intervals";
import { env } from "@/lib/env";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { Combobox } from "@/components/combobox";
import { ProblemAlert } from "@/components/problem-alert";

export interface BookDraft {
  room: Room;
  date: string;
  start: string;
  end: string;
}

/**
 * Booking submission dialog (FR7). Lets the user edit the room, date, start/end
 * times, attendees and purpose before submitting. Re-shows inline conflict
 * warnings from the RFC 9457 response (FR8), validates capacity client-side,
 * and double-checks the requested slot is still free before create.
 */
export function BookDialog({
  draft,
  rooms,
  open,
  onOpenChange,
}: {
  draft: BookDraft | null;
  rooms: Room[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = React.useState<unknown>(null);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: draft
      ? {
          room_id: draft.room.id,
          date: draft.date,
          start: draft.start,
          end: draft.end,
          purpose: "",
          attendee_count: 1,
        }
      : undefined,
  });

  const roomIdValue = useWatch({ control: form.control, name: "room_id" });
  const dateValue = useWatch({ control: form.control, name: "date" });
  const startValue = useWatch({ control: form.control, name: "start" });
  const endValue = useWatch({ control: form.control, name: "end" });

  const selectedRoom = React.useMemo(
    () => rooms.find((r) => r.id === roomIdValue) ?? draft?.room,
    [rooms, roomIdValue, draft],
  );

  async function checkAvailability(
    roomId: string,
    date: string,
    start: string,
    end: string,
  ): Promise<boolean> {
    const res = unwrap(
      await api.GET("/api/v1/calendar", {
        params: {
          query: {
            view: "day",
            date,
            room_id: roomId,
          },
        },
      }),
    );
    const blocks = (res.data ?? []) as CalendarBlock[];
    const startMin = minutesOfDay(start);
    const endMin = minutesOfDay(end);
    return !blocks.some((block) => {
      if (block.source === "AVAILABLE") return false;
      const blockStart = minutesOfDay(block.start);
      const blockEnd = minutesOfDay(block.end);
      // Two intervals overlap when the requested start is before the block ends
      // and the requested end is after the block starts.
      return startMin < blockEnd && endMin > blockStart;
    });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    if (selectedRoom && values.attendee_count > selectedRoom.capacity) {
      form.setError("attendee_count", {
        message: `This room seats ${selectedRoom.capacity}.`,
      });
      return;
    }

    const available = await checkAvailability(
      values.room_id,
      values.date,
      values.start,
      values.end,
    );
    if (!available) {
      setSubmitError(
        new Error(
          "That time is no longer available for this room. Please choose a different slot.",
        ),
      );
      return;
    }

    try {
      // Combine local date + time (institution TZ) into RFC 3339 instants,
      // which the create endpoint expects as starts_at / ends_at (§8.3).
      const idempotencyKey = crypto.randomUUID();
      unwrap(
        await api.POST("/api/v1/bookings", {
          headers: { "Idempotency-Key": idempotencyKey },
          body: {
            room_id: values.room_id,
            starts_at: localToRfc3339(values.date, values.start, env.appTz),
            ends_at: localToRfc3339(values.date, values.end, env.appTz),
            purpose: values.purpose,
            attendee_count: values.attendee_count,
          } as never,
        }),
      );
      toast({
        variant: "success",
        title: "Request submitted",
        description: "You'll be notified once a booking officer reviews it.",
      });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err);
    }
  });

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book {selectedRoom?.name ?? draft.room.name}</DialogTitle>
          <DialogDescription>
            {selectedRoom?.room_code ?? draft.room.room_code} ·{" "}
            {ROOM_TYPE_LABELS[selectedRoom?.room_type ?? draft.room.room_type]} ·
            seats {selectedRoom?.capacity ?? draft.room.capacity}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {submitError ? <ProblemAlert error={submitError} /> : null}

          <Field
            id="room_id"
            label="Room"
            error={form.formState.errors.room_id?.message}
          >
            {(p) => (
              <Combobox
                id={p.id}
                value={roomIdValue}
                onValueChange={(v) =>
                  form.setValue("room_id", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Select a room"
                searchPlaceholder="Search rooms…"
                emptyText="No rooms available."
                options={rooms.map((r) => ({
                  value: r.id,
                  label: r.name,
                  description: `${r.room_code} · seats ${r.capacity}`,
                }))}
              />
            )}
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field id="date" label="Date" error={form.formState.errors.date?.message}>
              {(p) => (
                <DatePicker
                  id={p.id}
                  value={dateValue}
                  onChange={(v) =>
                    form.setValue("date", v, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>
            <Field id="start" label="Start" error={form.formState.errors.start?.message}>
              {(p) => (
                <TimePicker
                  id={p.id}
                  step={15}
                  value={startValue}
                  onChange={(v) =>
                    form.setValue("start", v, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>
            <Field id="end" label="End" error={form.formState.errors.end?.message}>
              {(p) => (
                <TimePicker
                  id={p.id}
                  step={15}
                  value={endValue}
                  onChange={(v) =>
                    form.setValue("end", v, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>
          </div>

          <Field
            id="attendee_count"
            label="Expected attendees"
            error={form.formState.errors.attendee_count?.message}
            description={`Maximum ${selectedRoom?.capacity ?? draft.room.capacity} for this room.`}
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                min={1}
                max={selectedRoom?.capacity ?? draft.room.capacity}
                {...form.register("attendee_count", { valueAsNumber: true })}
              />
            )}
          </Field>

          <Field
            id="purpose"
            label="Purpose"
            error={form.formState.errors.purpose?.message}
          >
            {(p) => (
              <Textarea
                {...p}
                placeholder="e.g. Departmental seminar, makeup lecture, club meeting"
                {...form.register("purpose")}
              />
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
