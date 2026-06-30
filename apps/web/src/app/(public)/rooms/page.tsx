import type { Metadata } from "next";
import Link from "next/link";
import { Building2, DoorOpen, LogIn, RefreshCcw, Users } from "lucide-react";
import type { Room } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";
import { Button } from "@cbs/ui/components/button";
import { EmptyState } from "@/components/empty-state";
import { RoomsDirectory } from "./rooms-directory";
import {
  AuraWatermark,
  IconWatermark,
  WatermarkConstellation,
} from "@/components/watermark";

export const metadata: Metadata = {
  title: "Facility directory",
  description:
    "Browse Ashesi University's bookable spaces — lecture halls, laboratories, seminar rooms, auditoria and conference rooms, with capacity and equipment.",
  alternates: { canonical: "/rooms" },
};

// ISR: stable public content, revalidated periodically (§12.1).
export const revalidate = 3600;

async function fetchPublicRooms(): Promise<Room[]> {
  // Public, anonymous read of the active room catalogue via the unauthenticated
  // /public endpoint — the authed /rooms route 401s for anonymous visitors,
  // which is why the directory previously showed "unavailable".
  const res = await fetch(
    `${apiOrigin}/api/v1/public/rooms?status=ACTIVE&limit=200`,
    { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: Room[] };
  return json.data ?? [];
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
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape "<" so a DB-sourced room name can't break out of the script
          // tag (JSON.stringify alone does not neutralise "</script>").
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="relative mb-8 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-8 shadow-sm sm:px-8 sm:py-10">
        <WatermarkConstellation
          icons={[DoorOpen, Building2, Users]}
          className="hidden sm:block"
        />
        <span className="relative mb-4 inline-flex items-center rounded-full border border-[color-mix(in_oklch,var(--color-maroon)_22%,var(--color-border))] bg-[var(--color-maroon-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-maroon)]">
          Public catalogue
        </span>
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Facility directory
            </h1>
            <p className="mt-3 text-[var(--color-muted-foreground)]">
              Every bookable space across the Ashesi campus. Sign in to check
              live availability and submit a reservation request.
            </p>
          </div>
          <Button className="min-h-12 w-full px-9 sm:w-auto" asChild>
            <Link href="/login">
              <LogIn className="size-4" />
              Sign in to reserve
            </Link>
          </Button>
        </div>
      </header>

      {rooms.length === 0 ? (
        <section className="relative overflow-hidden rounded-3xl">
          <AuraWatermark className="left-8 top-8 size-28 rotate-[-10deg]" />
          <IconWatermark
            icon={Building2}
            className="bottom-6 right-10 size-24 rotate-12"
          />
          <EmptyState
            icon={DoorOpen}
            title="Room directory unavailable"
            description="We could not load the latest public room catalogue. Try again shortly, or sign in to search live availability and submit a reservation request."
            actions={
              <>
                <Button asChild>
                  <Link href="/rooms">
                    <RefreshCcw className="size-4" />
                    Check again
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/login">
                    <LogIn className="size-4" />
                    Sign in
                  </Link>
                </Button>
              </>
            }
          />
        </section>
      ) : (
        <RoomsDirectory rooms={rooms} />
      )}
    </div>
  );
}
