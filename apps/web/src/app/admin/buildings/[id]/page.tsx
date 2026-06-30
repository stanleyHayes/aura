/* eslint-disable @next/next/no-img-element -- Building imagery is served from runtime catalogue upload URLs. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  DoorOpen,
  Images,
  Users,
} from "lucide-react";
import {
  ROOM_TYPE_LABELS,
  type Building,
  type Room,
} from "@cbs/schemas";
import { Badge, type BadgeProps } from "@cbs/ui/components/badge";
import { Button } from "@cbs/ui/components/button";
import { formatDateTime } from "@cbs/ui/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { serverApi } from "@/lib/api/server";
import { route } from "@/lib/route";
import {
  CatalogueDetailHero,
  DetailBackButton,
  DetailFields,
  DetailPanel,
  EmptyInline,
} from "../../_components/catalogue-detail";
import { CatalogueImageUploader } from "../../_components/catalogue-image-uploader";

export const metadata: Metadata = {
  title: "Building detail",
  robots: { index: false, follow: false },
};

const ROOM_STATUS_VARIANT = {
  ACTIVE: "approved",
  INACTIVE: "cancelled",
  UNDER_MAINTENANCE: "maintenance",
} satisfies Record<Room["status"], BadgeProps["variant"]>;

function label(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function RoomStatusBadge({ status }: { status: Room["status"] }) {
  return <Badge variant={ROOM_STATUS_VARIANT[status]}>{label(status)}</Badge>;
}

async function getBuilding(id: string) {
  const api = await serverApi();
  const buildingResult = await api.GET("/api/v1/buildings/{id}", {
    params: { path: { id } },
  });
  if (buildingResult.error || !buildingResult.data) return null;

  const building = buildingResult.data as Building;
  const roomsResult = await api.GET("/api/v1/rooms", {
    params: { query: { building_id: building.id, limit: 200 } },
  });

  return {
    building,
    rooms: roomsResult.error ? [] : ((roomsResult.data?.data ?? []) as Room[]),
  };
}

export default async function AdminBuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getBuilding(id);
  if (!detail) notFound();

  const { building, rooms } = detail;
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        icon={Building2}
        title={building.name}
        description={`${building.code} building catalogue profile with images, campus metadata and linked rooms.`}
        actions={
          <DetailBackButton href="/admin/buildings" label="Back to buildings" />
        }
      />

      <CatalogueDetailHero
        icon={Building2}
        imageUrl={building.image_url}
        galleryUrls={building.gallery_urls ?? []}
        imageAlt={`${building.name} building`}
        fallbackLabel={`${building.code} building image`}
        stats={[
          {
            label: "Rooms",
            value: rooms.length,
            subtext: "Total rooms in catalogue",
            icon: DoorOpen,
            tone: "brand",
          },
          {
            label: "Active rooms",
            value: activeRooms.length,
            subtext: "Currently bookable",
            icon: BadgeCheck,
            tone: "success",
          },
          {
            label: "Seat capacity",
            value: totalCapacity,
            subtext: "Combined catalogue seats",
            icon: Users,
            tone: "info",
          },
          {
            label: "Gallery",
            value: (building.gallery_urls ?? []).length,
            subtext: "Supporting images",
            icon: Images,
            tone: "warning",
          },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{building.code}</Badge>
          {building.campus ? <Badge variant="outline">{building.campus}</Badge> : null}
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Building profile
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-muted-foreground)]">
          This page links the physical building record to every room, image and
          campus label used by administrators and requester-facing filters.
        </p>
      </CatalogueDetailHero>

      <DetailPanel
        title="Images"
        description="Manage the building cover photo and supporting gallery images in a dedicated media section."
      >
        <div className="flex flex-col gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-maroon)]">
              <Images className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--color-foreground)]">
                Building media
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {building.image_url ? "Main image added" : "No main image yet"}{" "}
                - {(building.gallery_urls ?? []).length} gallery image
                {(building.gallery_urls ?? []).length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            <CatalogueImageUploader
              kind="building"
              entityId={building.id}
              entityName={`${building.name} (${building.code})`}
              existingMainUrl={building.image_url}
              existingGalleryUrls={building.gallery_urls ?? []}
            />
          </div>
        </div>
      </DetailPanel>

      <DetailPanel
        title="Rooms in this building"
        description="The rooms attached to this building. Open any profile to inspect capacity, status and equipment."
      >
        {rooms.length === 0 ? (
          <EmptyInline
            icon={DoorOpen}
            title="No rooms attached yet"
            description="Create or import rooms with this building selected to connect the catalogue."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-3 sm:flex-row sm:items-center"
              >
                {room.image_url ? (
                  <img
                    src={room.image_url}
                    alt={`${room.name} room`}
                    className="size-16 rounded-xl border border-[var(--color-border)] object-cover sm:shrink-0"
                  />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
                    <DoorOpen className="size-6" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-[var(--color-foreground)]">
                      {room.name}
                    </p>
                    <RoomStatusBadge status={room.status} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    {room.room_code} - {ROOM_TYPE_LABELS[room.room_type]} -{" "}
                    {room.capacity} seats
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={route(`/admin/rooms/${room.id}`)}>View room</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DetailPanel>

      <DetailPanel
        title="Record details"
        description="Identifier and audit timestamps for this catalogue record."
        className="bg-[color-mix(in_oklch,var(--color-muted)_18%,var(--color-card))]"
      >
        <DetailFields
          fields={[
            { label: "Building ID", value: building.id },
            { label: "Created", value: formatDateTime(building.created_at) },
            { label: "Updated", value: formatDateTime(building.updated_at) },
          ]}
        />
      </DetailPanel>
    </div>
  );
}
