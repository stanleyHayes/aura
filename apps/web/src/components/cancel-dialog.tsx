"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CancelBookingForm as Schema,
  type CancelBookingForm as Values,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
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
import { api, unwrap } from "@/lib/api/client";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

export function CancelDialog({
  bookingId,
  onOpenChange,
}: {
  bookingId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorState, setErrorState] = React.useState<{
    bookingId: string | null;
    error: unknown;
  }>({ bookingId: null, error: null });
  const error =
    errorState.bookingId === bookingId ? errorState.error : null;

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { note: "" },
  });

  React.useEffect(() => {
    form.reset();
  }, [bookingId, form]);

  const cancel = useMutation({
    mutationFn: async (values: Values) =>
      unwrap(
        await api.POST("/api/v1/bookings/{id}/cancel", {
          params: { path: { id: bookingId! } },
          body: { note: values.note || undefined },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Booking cancelled" });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => setErrorState({ bookingId, error: err }),
  });

  return (
    <Dialog open={bookingId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking</DialogTitle>
          <DialogDescription>
            Add a short reason so the room officer knows why the space is being released.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => {
            setErrorState({ bookingId, error: null });
            cancel.mutate(v);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? <ProblemAlert error={error} /> : null}
          <Field
            id="cancel-note"
            label="Reason (optional)"
            error={form.formState.errors.note?.message}
          >
            {(p) => (
              <Textarea
                {...p}
                placeholder="e.g. The event has been postponed."
                {...form.register("note")}
              />
            )}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Keep booking
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
