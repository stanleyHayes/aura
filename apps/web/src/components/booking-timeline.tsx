import { Check, Clock, X } from "lucide-react";
import type { Booking } from "@cbs/schemas";
import { cn } from "@cbs/ui/lib/cn";
import { formatDateTime } from "@cbs/ui/lib/datetime";

type Step = {
  label: string;
  at?: string | null;
  state: "done" | "current" | "pending" | "rejected";
  detail?: string | null;
};

/** Status timeline for a booking (§10.3 "status timeline"). */
export function BookingTimeline({ booking }: { booking: Booking }) {
  const steps: Step[] = [
    {
      label: "Request submitted",
      at: booking.created_at,
      state: "done",
    },
  ];

  if (booking.status === "PENDING") {
    steps.push({ label: "Awaiting review", state: "current" });
  } else if (booking.status === "APPROVED") {
    steps.push({
      label: "Approved",
      at: booking.reviewed_at,
      state: "done",
      detail: booking.review_note,
    });
  } else if (booking.status === "REJECTED") {
    steps.push({
      label: "Rejected",
      at: booking.reviewed_at,
      state: "rejected",
      detail: booking.review_note,
    });
  } else if (booking.status === "CANCELLED") {
    steps.push({
      label: "Cancelled",
      at: booking.cancelled_at,
      state: "rejected",
    });
  } else if (booking.status === "EXPIRED") {
    steps.push({
      label: "Expired before review",
      state: "rejected",
    });
  }

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border",
                  step.state === "done" &&
                    "border-[var(--color-approved)] bg-[color-mix(in_oklch,var(--color-approved)_15%,transparent)] text-[var(--color-approved)]",
                  step.state === "current" &&
                    "border-[var(--color-pending)] bg-[color-mix(in_oklch,var(--color-pending)_15%,transparent)] text-[var(--color-pending)]",
                  step.state === "rejected" &&
                    "border-[var(--color-rejected)] bg-[color-mix(in_oklch,var(--color-rejected)_15%,transparent)] text-[var(--color-rejected)]",
                  step.state === "pending" &&
                    "border-[var(--color-border)] text-[var(--color-muted-foreground)]",
                )}
                aria-hidden="true"
              >
                {step.state === "done" ? (
                  <Check className="size-4" />
                ) : step.state === "rejected" ? (
                  <X className="size-4" />
                ) : (
                  <Clock className="size-4" />
                )}
              </span>
              {!isLast ? (
                <span className="my-1 w-px flex-1 bg-[var(--color-border)]" />
              ) : null}
            </div>
            <div className={cn("pb-6", isLast && "pb-0")}>
              <p className="text-sm font-medium">{step.label}</p>
              {step.at ? (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {formatDateTime(step.at)}
                </p>
              ) : null}
              {step.detail ? (
                <p className="mt-1 rounded-md bg-[var(--color-muted)] px-2 py-1 text-xs text-[var(--color-muted-foreground)]">
                  “{step.detail}”
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
