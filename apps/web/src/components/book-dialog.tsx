"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreateBookingForm as Schema,
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
import { localToRfc3339 } from "@/lib/intervals";
import { env } from "@/lib/env";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

export interface BookDraft {
  room: Room;
  date: string;
  start: string;
  end: string;
}

/**
 * Booking submission dialog (FR7). Re-shows inline conflict warnings from the
 * RFC 9457 response (FR8) and validates capacity client-side before submit.
 */
export function BookDialog({
  draft,
  open,
  onOpenChange,
}: {
  draft: BookDraft | null;
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

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    if (draft && values.attendee_count > draft.room.capacity) {
      form.setError("attendee_count", {
        message: `This room seats ${draft.room.capacity}.`,
      });
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
          <DialogTitle>Book {draft.room.name}</DialogTitle>
          <DialogDescription>
            {draft.room.room_code} · {ROOM_TYPE_LABELS[draft.room.room_type]} ·
            seats {draft.room.capacity}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {submitError ? <ProblemAlert error={submitError} /> : null}

          <div className="grid grid-cols-3 gap-3">
            <Field id="date" label="Date" error={form.formState.errors.date?.message}>
              {(p) => <Input {...p} type="date" {...form.register("date")} />}
            </Field>
            <Field id="start" label="Start" error={form.formState.errors.start?.message}>
              {(p) => <Input {...p} type="time" {...form.register("start")} />}
            </Field>
            <Field id="end" label="End" error={form.formState.errors.end?.message}>
              {(p) => <Input {...p} type="time" {...form.register("end")} />}
            </Field>
          </div>

          <Field
            id="attendee_count"
            label="Expected attendees"
            error={form.formState.errors.attendee_count?.message}
            description={`Maximum ${draft.room.capacity} for this room.`}
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                min={1}
                max={draft.room.capacity}
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
