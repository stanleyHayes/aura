import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { createApi } from "@cbs/api-client";
import { ROOM_TYPE_LABELS, type Room } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Badge } from "@cbs/ui/components/badge";

export const metadata: Metadata = {
  title: "Room directory",
  description:
    "Browse the university's bookable classrooms — lecture halls, laboratories, seminar rooms, auditoria and conference rooms, with capacity and equipment.",
  alternates: { canonical: "/rooms" },
};

// ISR: stable public content, revalidated periodically (§12.1).
export const revalidate = 3600;

async function fetchPublicRooms(): Promise<Room[]> {
  // Public, anonymous read of the active room catalogue.
  const api = createApi({ baseUrl: apiOrigin });
  const { data } = await api.GET("/api/v1/rooms", {
    params: { query: { status: "ACTIVE", limit: 200 } },
  });
  return (data?.data ?? []) as Room[];
}

export default async function RoomDirectoryPage() {
  let rooms: Room[] = [];
  try {
    rooms = await fetchPublicRooms();
  } catch {
    rooms = [];
  }

  // JSON-LD (§12.1) — list of schema.org Room/Place entities.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "University classroom directory",
    itemListElement: rooms.slice(0, 50).map((room, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Room",
        name: room.name,
        identifier: room.room_code,
        url: `${env.siteUrl}/rooms/${room.id}`,
        maximumAttendeeCapacity: room.capacity,
        containedInPlace: room.building_name
          ? { "@type": "Place", name: room.building_name }
          : undefined,
      },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight">Room directory</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">
          Every bookable classroom across the campus. Sign in to check live
          availability and submit a booking request.
        </p>
      </header>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-[var(--color-muted-foreground)]">
            The room directory is currently unavailable. Please check back
            shortly.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/rooms/${room.id}`}
                className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
              >
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-serif text-lg tracking-tight">
                          {room.name}
                        </h2>
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          {room.room_code}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {ROOM_TYPE_LABELS[room.room_type]}
                      </Badge>
                    </div>
                    <dl className="mt-auto flex flex-col gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                      {room.building_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4" aria-hidden="true" />
                          <dt className="sr-only">Building</dt>
                          <dd>{room.building_name}</dd>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <Users className="size-4" aria-hidden="true" />
                        <dt className="sr-only">Capacity</dt>
                        <dd>Seats {room.capacity}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
