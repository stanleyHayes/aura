/* eslint-disable @next/next/no-img-element -- Room imagery is served from runtime catalogue upload URLs. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  DoorOpen,
  Images,
  Layers3,
  Users,
  Wrench,
} from "lucide-react";
import {
  ROOM_TYPE_LABELS,
  type Building,
  type Room,
  type RoomEquipment,
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
  title: "Room detail",
  robots: { index: false, follow: false },
};

type RoomDetailPayload = {
  room?: Room;
  equipment?: RoomEquipment[] | null;
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

async function getRoom(id: string) {
  const api = await serverApi();
  const roomResult = await api.GET("/api/v1/rooms/{id}", {
    params: { path: { id } },
  });
  if (roomResult.error || !roomResult.data) return null;

  const payload = roomResult.data as RoomDetailPayload;
  if (!payload.room) return null;

  const room: Room = {
    ...payload.room,
    equipment: payload.equipment ?? payload.room.equipment ?? [],
  };

  const buildingResult = await api.GET("/api/v1/buildings/{id}", {
    params: { path: { id: room.building_id } },
  });

  return {
    room,
    building: buildingResult.error ? null : (buildingResult.data as Building),
  };
}

export default async function AdminRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getRoom(id);
  if (!detail) notFound();

  const { room, building } = detail;
  const equipment = room.equipment ?? [];
  const buildingName =
    building?.name ?? room.building_name ?? "Unassigned building";
  const buildingCode = building?.code ?? room.building_code;

  return (
    <div className="space-y-7">
      <PageHeader
        icon={DoorOpen}
        title={room.name}
        description={`${room.room_code} in ${buildingName}. Inspect capacity, type, status, images and fixed equipment.`}
        actions={
          <>
            <DetailBackButton href="/admin/rooms" label="Back to rooms" />
            {room.status === "ACTIVE" ? (
              <Button variant="outline" asChild>
                <Link href={route(`/rooms/${room.id}`)}>Public page</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <CatalogueDetailHero
        icon={DoorOpen}
        imageUrl={room.image_url}
        galleryUrls={room.gallery_urls ?? []}
        imageAlt={`${room.name} room`}
        fallbackLabel={`${room.room_code} room image`}
        stats={[
          {
            label: "Capacity",
            value: room.capacity,
            subtext: "Bookable seats",
            icon: Users,
            tone: "brand",
          },
          {
            label: "Room type",
            value: ROOM_TYPE_LABELS[room.room_type],
            subtext: "Catalogue classification",
            icon: Layers3,
            tone: "info",
          },
          {
            label: "Equipment",
            value: equipment.length,
            subtext: "Fixed equipment lines",
            icon: Wrench,
            tone: equipment.length > 0 ? "success" : "neutral",
          },
          {
            label: "Gallery",
            value: (room.gallery_urls ?? []).length,
            subtext: "Supporting images",
            icon: Images,
            tone: "warning",
          },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{room.room_code}</Badge>
          <RoomStatusBadge status={room.status} />
          {building ? (
            <Link
              href={route(`/admin/buildings/${building.id}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-maroon)]"
            >
              <Building2 className="size-3.5" aria-hidden="true" />
              {building.name}
              {buildingCode ? ` (${buildingCode})` : ""}
            </Link>
          ) : (
            <Badge variant="outline">{buildingName}</Badge>
          )}
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Catalogue profile
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-muted-foreground)]">
          This is the operational view of the room record used by booking,
          availability, timetable imports and public room discovery.
        </p>
      </CatalogueDetailHero>

      <DetailPanel
        title="Images"
        description="Manage the main room photo and supporting gallery images in a dedicated media section."
      >
        <div className="flex flex-col gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-maroon)]">
              <Images className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--color-foreground)]">
                Room media
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {room.image_url ? "Main image added" : "No main image yet"} -{" "}
                {(room.gallery_urls ?? []).length} gallery image
                {(room.gallery_urls ?? []).length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            <CatalogueImageUploader
              kind="room"
              entityId={room.id}
              entityName={`${room.name} (${room.room_code})`}
              existingMainUrl={room.image_url}
              existingGalleryUrls={room.gallery_urls ?? []}
            />
          </div>
        </div>
      </DetailPanel>

      <DetailPanel
        title="Fixed equipment"
        description="Equipment attached to this room and visible to filtering workflows."
      >
        {equipment.length === 0 ? (
          <EmptyInline
            icon={Wrench}
            title="No fixed equipment recorded"
            description="Add equipment from the room edit workflow when this room has permanent facilities."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((item) => (
              <li
                key={item.equipment_id}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-3"
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={`${item.name} equipment`}
                    className="size-14 shrink-0 rounded-xl border border-[var(--color-border)] object-cover"
                  />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
                    <Wrench className="size-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--color-foreground)]">
                    {item.name}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    {item.code}
                  </p>
                </div>
                <Badge variant="secondary">{item.quantity}x</Badge>
              </li>
            ))}
          </ul>
        )}
      </DetailPanel>

      <DetailPanel
        title="Record details"
        description="Identifiers and audit timestamps for this catalogue record."
        className="bg-[color-mix(in_oklch,var(--color-muted)_18%,var(--color-card))]"
      >
        <DetailFields
          fields={[
            { label: "Room ID", value: room.id },
            { label: "Building ID", value: room.building_id },
            { label: "Created", value: formatDateTime(room.created_at) },
            { label: "Updated", value: formatDateTime(room.updated_at) },
            { label: "Status", value: <RoomStatusBadge status={room.status} /> },
          ]}
        />
      </DetailPanel>
    </div>
  );
}
