"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RejectBookingForm as Schema,
  type RejectBookingForm as Values,
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
import { qk } from "@/lib/query-keys";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

export function RejectDialog({
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

  // The dialog is permanently mounted (only `open` toggles), so reset the note
  // whenever it targets a different booking; errors are keyed by booking below.
  React.useEffect(() => {
    form.reset();
  }, [bookingId, form]);

  const reject = useMutation({
    mutationFn: async (values: Values) =>
      unwrap(
        await api.POST("/api/v1/bookings/{id}/reject", {
          params: { path: { id: bookingId! } },
          body: { note: values.note },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Request rejected" });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: qk.bookingMetrics });
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => setErrorState({ bookingId, error: err }),
  });

  return (
    <Dialog open={bookingId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this request</DialogTitle>
          <DialogDescription>
            The requester will be notified with your reason.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => {
            setErrorState({ bookingId, error: null });
            reject.mutate(v);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? <ProblemAlert error={error} /> : null}
          <Field
            id="reject-note"
            label="Reason"
            error={form.formState.errors.note?.message}
            required
          >
            {(p) => (
              <Textarea
                {...p}
                placeholder="e.g. The room is reserved for an examination that week."
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
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={reject.isPending}>
              {reject.isPending ? "Rejecting…" : "Reject request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
