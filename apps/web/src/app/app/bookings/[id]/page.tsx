import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Users } from "lucide-react";
import type { Booking } from "@cbs/schemas";
import { serverApi } from "@/lib/api/server";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
import { StatusBadge } from "@/components/status-badge";
import { BookingTimeline } from "@/components/booking-timeline";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";

export const metadata: Metadata = {
  title: "Booking detail",
  robots: { index: false, follow: false },
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/bookings/{id}", {
    params: { path: { id } },
  });
  const booking = data as Booking | undefined;
  if (!booking) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/app/bookings">
          <ArrowLeft className="size-4" /> Back to my bookings
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">
            {booking.room?.name ?? "Room booking"}
          </h2>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            {booking.purpose}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader>
            <CardTitle>Status timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingTimeline booking={booking} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--color-muted-foreground)]">When</dt>
                <dd className="font-medium">{formatDate(booking.starts_at)}</dd>
                <dd>{formatTimeRange(booking.starts_at, booking.ends_at)}</dd>
              </div>
              {booking.room?.building_name ? (
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                  <dd>{booking.room.building_name}</dd>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                <dd>
                  {booking.attendee_count} attendee
                  {booking.attendee_count === 1 ? "" : "s"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
