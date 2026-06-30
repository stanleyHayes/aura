"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  OverrideBookingForm as Schema,
  type OverrideBookingForm as Values,
} from "@cbs/schemas";
import { ShieldAlert } from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { Textarea } from "@cbs/ui/components/textarea";
import { Checkbox } from "@cbs/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cbs/ui/components/dialog";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { Field } from "@/components/forms/field";
import { ProblemAlert } from "@/components/problem-alert";

/** Admin override (BR6). Forces a booking through, optionally cancelling
 *  conflicting approved bookings; the action is fully audited server-side. */
export function OverrideDialog({
  bookingId,
  onOpenChange,
}: {
  bookingId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<unknown>(null);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { note: "", cancel_conflicting: false },
  });
  const cancelConflicting = useWatch({
    control: form.control,
    name: "cancel_conflicting",
  });

  const override = useMutation({
    mutationFn: async (values: Values) =>
      unwrap(
        await api.POST("/api/v1/bookings/{id}/override", {
          params: { path: { id: bookingId! } },
          body: {
            note: values.note,
            cancel_conflicting: values.cancel_conflicting,
          },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Booking overridden and approved" });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: qk.bookingMetrics });
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => setError(err),
  });

  return (
    <Dialog open={bookingId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override and approve</DialogTitle>
          <DialogDescription>
            This forces the booking through despite conflicts. The action is
            recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning" className="mb-1">
          <ShieldAlert />
          <AlertTitle>This bypasses normal conflict checks</AlertTitle>
          <AlertDescription>
            Lectures normally take precedence. Only override with good reason.
          </AlertDescription>
        </Alert>

        <form
          onSubmit={form.handleSubmit((v) => {
            setError(null);
            override.mutate(v);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? <ProblemAlert error={error} /> : null}

          <Field
            id="override-note"
            label="Justification"
            error={form.formState.errors.note?.message}
            required
          >
            {(p) => (
              <Textarea
                {...p}
                placeholder="Why are you overriding the conflict?"
                {...form.register("note")}
              />
            )}
          </Field>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={cancelConflicting}
              onCheckedChange={(c) =>
                form.setValue("cancel_conflicting", Boolean(c))
              }
              className="mt-0.5"
            />
            <span>
              Cancel any conflicting <strong>approved</strong> bookings and
              notify those requesters.
            </span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={override.isPending}>
              {override.isPending ? "Overriding…" : "Override & approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
