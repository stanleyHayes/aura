/* eslint-disable @next/next/no-img-element -- Public room imagery is served from runtime catalogue upload URLs. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Calendar,
  DoorOpen,
  Users,
  Wrench,
} from "lucide-react";
import { ROOM_TYPE_LABELS, type Room, type RoomEquipment } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";
import { Button } from "@cbs/ui/components/button";
import { Badge } from "@cbs/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
import { Separator } from "@cbs/ui/components/separator";
import {
  AuraWatermark,
  IconWatermark,
  WatermarkConstellation,
} from "@/components/watermark";

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

  const equipment = room.equipment ?? [];
  const gallery = room.gallery_urls ?? [];

  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 py-10 sm:py-12">
      <AuraWatermark className="right-0 top-10 hidden size-56 rotate-[-8deg] lg:block" />
      <IconWatermark
        icon={DoorOpen}
        className="-left-10 top-52 hidden size-44 rotate-[-12deg] md:block"
      />
      <WatermarkConstellation
        icons={[Building2, Users, Boxes, Calendar]}
        className="hidden opacity-80 xl:block"
        includeAura={false}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape "<" so a DB-sourced room name can't break out of the script
          // tag (JSON.stringify alone does not neutralise "</script>").
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link href="/rooms">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to directory
        </Link>
      </Button>

      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* MAIN column — hero, gallery, equipment */}
        <div className="order-2 flex flex-col gap-8 lg:order-1 lg:col-span-8">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
            <IconWatermark
              icon={DoorOpen}
              className="-right-10 bottom-2 size-40 rotate-12"
            />
            {room.image_url ? (
              <div className="h-[clamp(16rem,42vw,27.5rem)] w-full border-b border-[var(--color-border)]">
                <img
                  src={room.image_url}
                  alt={`${room.name} room`}
                  className="block h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="grid h-[clamp(16rem,42vw,27.5rem)] w-full place-items-center border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_74%,var(--color-card))] text-[var(--color-muted-foreground)] dark:bg-[color-mix(in_oklch,var(--color-muted)_48%,var(--color-card))] dark:text-[color-mix(in_oklch,var(--color-paper-50)_62%,transparent)]">
                <DoorOpen className="size-14" aria-hidden="true" />
              </div>
            )}
            <div className="relative flex flex-wrap items-start justify-between gap-4 p-6">
              <div className="min-w-0">
                <h1 className="font-serif text-3xl tracking-tight">
                  {room.name}
                </h1>
                <p className="mt-1 text-[var(--color-muted-foreground)]">
                  {room.room_code}
                </p>
              </div>
              <Badge variant="secondary" className="text-sm">
                {ROOM_TYPE_LABELS[room.room_type]}
              </Badge>
            </div>
          </div>

          {/* Gallery — only when present */}
          {gallery.length > 0 ? (
            <section
              aria-labelledby="gallery-heading"
              className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm"
            >
              <IconWatermark
                icon={Boxes}
                className="-right-8 top-2 size-28 rotate-6"
              />
              <h2
                id="gallery-heading"
                className="relative mb-3 font-serif text-lg tracking-tight"
              >
                Gallery
              </h2>
              <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
                {gallery.slice(0, 8).map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`${room.name} gallery image ${index + 1}`}
                    className="block aspect-square w-full rounded-xl border border-[var(--color-border)] object-cover"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Equipment */}
          <section aria-labelledby="equipment-heading">
            <h2
              id="equipment-heading"
              className="mb-3 font-serif text-lg tracking-tight"
            >
              Equipment
            </h2>
            <Card className="relative overflow-hidden">
              <IconWatermark
                icon={Wrench}
                className="-right-8 top-4 size-28 rotate-12"
              />
              <CardContent className="relative p-5">
                {equipment.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-[color-mix(in_oklch,var(--color-muted)_60%,transparent)] text-[var(--color-muted-foreground)]">
                      <Wrench className="size-5" aria-hidden="true" />
                    </span>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      No fixed equipment recorded for this room.
                    </p>
                  </div>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {equipment.map((e) => (
                      <li key={e.equipment_id}>
                        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_28%,transparent)] p-2">
                          {e.image_url ? (
                            <img
                              src={e.image_url}
                              alt={`${e.name} equipment`}
                              className="block size-12 shrink-0 rounded-lg border border-[var(--color-border)] object-cover"
                            />
                          ) : (
                            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
                              <Wrench className="size-5" aria-hidden="true" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--color-foreground)]">
                              {e.name}
                            </p>
                            <p className="truncate text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
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
          </section>
        </div>

        {/* RIGHT column — sticky summary + booking */}
        <aside className="order-1 lg:order-2 lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <Card className="relative overflow-hidden shadow-sm">
              <IconWatermark
                icon={Building2}
                className="-right-7 top-4 size-28 rotate-6"
              />
              <CardHeader className="relative">
                <CardTitle className="font-serif text-lg tracking-tight">
                  Room summary
                </CardTitle>
              </CardHeader>
              <CardContent className="relative flex flex-col gap-4">
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <DoorOpen
                      className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
                      aria-hidden="true"
                    />
                    <dt className="w-20 shrink-0 text-[var(--color-muted-foreground)]">
                      Type
                    </dt>
                    <dd className="min-w-0 font-medium">
                      {ROOM_TYPE_LABELS[room.room_type]}
                    </dd>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Users
                      className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
                      aria-hidden="true"
                    />
                    <dt className="w-20 shrink-0 text-[var(--color-muted-foreground)]">
                      Capacity
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {room.capacity} seats
                    </dd>
                  </div>
                  {room.building_name ? (
                    <>
                      <Separator />
                      <div className="flex items-center gap-3">
                        <Building2
                          className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
                          aria-hidden="true"
                        />
                        <dt className="w-20 shrink-0 text-[var(--color-muted-foreground)]">
                          Building
                        </dt>
                        <dd className="min-w-0 font-medium">
                          {room.building_name}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Boxes
                      className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
                      aria-hidden="true"
                    />
                    <dt className="w-20 shrink-0 text-[var(--color-muted-foreground)]">
                      Equipment
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {equipment.length}{" "}
                      {equipment.length === 1 ? "item" : "items"}
                    </dd>
                  </div>
                </dl>

                {/* Booking pitch — on-brand maroon-tint surface so the CTA reads
                    as the primary action without a loud filled block. */}
                <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--color-maroon)_16%,var(--color-border))] bg-[color-mix(in_oklch,var(--color-maroon-tint)_76%,var(--color-card))] p-4 text-[var(--color-maroon-dark)] dark:border-[color-mix(in_oklch,var(--color-maroon)_36%,var(--color-border))] dark:bg-[color-mix(in_oklch,var(--color-maroon)_24%,var(--color-card))] dark:text-[var(--color-paper-50)]">
                  <IconWatermark
                    icon={Calendar}
                    className="-right-5 -top-4 size-24 rotate-12"
                  />
                  <h2 className="relative flex items-center gap-2 font-serif text-base tracking-tight text-current">
                    <Calendar
                      className="size-4 shrink-0 text-[var(--color-maroon)] dark:text-[var(--color-maroon-tint)]"
                      aria-hidden="true"
                    />
                    Book this room
                  </h2>
                  <p className="relative text-sm text-[color-mix(in_oklch,var(--color-maroon-dark)_72%,var(--color-muted-foreground))] dark:text-[color-mix(in_oklch,var(--color-paper-50)_78%,transparent)]">
                    Sign in to check live availability for your date and time,
                    then submit a request.
                  </p>
                  <Button asChild size="lg" className="relative w-full">
                    <Link href={`/login?next=/app/search`}>
                      Sign in to check availability
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
