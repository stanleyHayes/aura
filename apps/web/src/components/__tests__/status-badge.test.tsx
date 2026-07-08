import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@cbs/schemas";
import { StatusBadge } from "@/components/status-badge";

/**
 * StatusBadge wires the shared booking-status enum labels into the shared Badge.
 * This renders the real component and asserts label + variant for each status,
 * so a regression in the label map or variant map is caught.
 */

describe("StatusBadge", () => {
  const cases: { status: BookingStatus; variant: string }[] = [
    { status: "PENDING", variant: "pending" },
    { status: "APPROVED", variant: "approved" },
    { status: "REJECTED", variant: "rejected" },
    { status: "CANCELLED", variant: "cancelled" },
    { status: "EXPIRED", variant: "expired" },
  ];

  it.each(cases)(
    "renders the human label for the $status status",
    ({ status }) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(BOOKING_STATUS_LABELS[status])).toBeInTheDocument();
    },
  );

  it("applies the status-specific badge variant class", () => {
    render(<StatusBadge status="APPROVED" />);
    expect(screen.getByText(BOOKING_STATUS_LABELS.APPROVED).className).toContain("--color-approved");
  });
});
