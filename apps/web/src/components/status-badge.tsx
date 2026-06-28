import { BOOKING_STATUS_LABELS, type BookingStatus } from "@cbs/schemas";
import { Badge, type BadgeProps } from "@cbs/ui/components/badge";

const VARIANT: Record<BookingStatus, BadgeProps["variant"]> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={VARIANT[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}
