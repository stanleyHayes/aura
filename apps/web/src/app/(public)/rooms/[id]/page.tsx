import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, DoorOpen, Users, Wrench } from "lucide-react";
import { ROOM_TYPE_LABELS, type Room, type RoomEquipment } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";
import { Button } from "@cbs/ui/components/button";
import { Badge } from "@cbs/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";

export const revalidate = 3600;

type RoomDetail = Room & { equipment: RoomEquipment[] };

/**
 * Public detail endpoint returns `{ room, equipment }` for an ACTIVE room
 * (anonymous, read-only).
 */
async function fetchRoom(id: string): Promise<RoomDetail | null> {
  const res = await fetch(`${apiOrigin}/api/v1/public/rooms/${id}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    room?: Room;
    equipment?: RoomEquipment[];
  };
  if (!data.room) return null;
  return { ...data.room, equipment: data.equipment ?? [] };
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
    room.building_name ? ` in ${room.building_name}` : ""
  }. Check live availability and book.`;
  return {
    title,
    description,
    alternates: { canonical: `/rooms/${room.id}` },
    openGraph: {
      title,
      description,
      url: `/rooms/${room.id}`,
      images: room.image_url ? [{ url: room.image_url }] : undefined,
    },
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
    amenityFeature: (room.equipment ?? []).map((e) => ({
      "@type": "LocationFeatureSpecification",
      name: e.name,
      value: true,
    })),
    containedInPlace: room.building_name
      ? { "@type": "Place", name: room.building_name }
      : undefined,
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape "<" so a DB-sourced room name can't break out of the script
          // tag (JSON.stringify alone does not neutralise "</script>").
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/rooms">
          <ArrowLeft className="size-4" /> Back to directory
        </Link>
      </Button>

      <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
        {room.image_url ? (
          <div className="aspect-[16/8] max-h-[420px] border-b border-[var(--color-border)]">
            <img
              src={room.image_url}
              alt={`${room.name} room`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="grid aspect-[16/7] max-h-72 place-items-center border-b border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <DoorOpen className="size-14" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
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
      </div>

      {(room.gallery_urls ?? []).length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(room.gallery_urls ?? []).slice(0, 8).map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={`${room.name} gallery image ${index + 1}`}
              className="aspect-square rounded-xl border border-[var(--color-border)] object-cover"
            />
          ))}
        </div>
      ) : null}

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
              {room.building_name ? (
                <div className="flex items-center gap-3">
                  <Building2 className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                  <dt className="w-24 text-[var(--color-muted-foreground)]">Building</dt>
                  <dd className="font-medium">{room.building_name}</dd>
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
            {(room.equipment ?? []).length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No fixed equipment recorded for this room.
              </p>
            ) : (
              <ul className="grid gap-2">
                {(room.equipment ?? []).map((e) => (
                  <li key={e.equipment_id}>
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_28%,transparent)] p-2">
                      {e.image_url ? (
                        <img
                          src={e.image_url}
                          alt={`${e.name} equipment`}
                          className="size-12 rounded-lg border border-[var(--color-border)] object-cover"
                        />
                      ) : (
                        <span className="grid size-12 place-items-center rounded-lg bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
                          <Wrench className="size-5" aria-hidden="true" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-foreground)]">
                          {e.name}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                          {e.code}
                          {e.quantity > 1 ? ` · ${e.quantity} units` : ""}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
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
