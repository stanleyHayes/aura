import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Users } from "lucide-react";
import { createApi } from "@cbs/api-client";
import { ROOM_TYPE_LABELS, type Room } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";
import { Button } from "@cbs/ui/components/button";
import { Badge } from "@cbs/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";

export const revalidate = 3600;

async function fetchRoom(id: string): Promise<Room | null> {
  const api = createApi({ baseUrl: apiOrigin });
  const { data } = await api.GET("/api/v1/rooms/{id}", {
    params: { path: { id } },
  });
  return (data as Room | undefined) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let room: Room | null = null;
  try {
    room = await fetchRoom(id);
  } catch {
    room = null;
  }
  if (!room) return { title: "Room not found" };
  const title = `${room.name} (${room.room_code})`;
  const description = `${ROOM_TYPE_LABELS[room.room_type]} seating ${room.capacity}${
    room.building ? ` in ${room.building.name}` : ""
  }. Check live availability and book.`;
  return {
    title,
    description,
    alternates: { canonical: `/rooms/${room.id}` },
    openGraph: { title, description, url: `/rooms/${room.id}` },
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let room: Room | null = null;
  try {
    room = await fetchRoom(id);
  } catch {
    room = null;
  }
  if (!room) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Room",
    name: room.name,
    identifier: room.room_code,
    url: `${env.siteUrl}/rooms/${room.id}`,
    maximumAttendeeCapacity: room.capacity,
    amenityFeature: room.equipment.map((e) => ({
      "@type": "LocationFeatureSpecification",
      name: e.name,
      value: true,
    })),
    containedInPlace: room.building
      ? {
          "@type": "Place",
          name: room.building.name,
          address: room.building.campus ?? undefined,
        }
      : undefined,
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/rooms">
          <ArrowLeft className="size-4" /> Back to directory
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">{room.name}</h1>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            {room.room_code}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {ROOM_TYPE_LABELS[room.room_type]}
        </Badge>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Users className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                <dt className="w-24 text-[var(--color-muted-foreground)]">Capacity</dt>
                <dd className="font-medium">{room.capacity} seats</dd>
              </div>
              {room.building ? (
                <div className="flex items-center gap-3">
                  <Building2 className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                  <dt className="w-24 text-[var(--color-muted-foreground)]">Building</dt>
                  <dd className="font-medium">{room.building.name}</dd>
                </div>
              ) : null}
              {room.building?.campus ? (
                <div className="flex items-center gap-3">
                  <MapPin className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                  <dt className="w-24 text-[var(--color-muted-foreground)]">Campus</dt>
                  <dd className="font-medium">{room.building.campus}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            {room.equipment.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No fixed equipment recorded for this room.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {room.equipment.map((e) => (
                  <li key={e.equipment_id}>
                    <Badge variant="outline">
                      {e.name}
                      {e.quantity > 1 ? ` ×${e.quantity}` : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-paper-100)] p-6">
        <h2 className="font-serif text-lg tracking-tight">Want to book this room?</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Sign in to check live availability for your date and time, then submit
          a request.
        </p>
        <Button asChild className="mt-4">
          <Link href={`/login?next=/app/search`}>Sign in to check availability</Link>
        </Button>
      </div>
    </div>
  );
}
