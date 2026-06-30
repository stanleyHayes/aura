import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DoorOpen,
  Hash,
  Images,
  PackageCheck,
  Shapes,
  Wrench,
} from "lucide-react";
import {
  ROOM_TYPE_LABELS,
  type Equipment,
  type Room,
} from "@cbs/schemas";
import { Badge, type BadgeProps } from "@cbs/ui/components/badge";
import { Button } from "@cbs/ui/components/button";
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

export const metadata: Metadata = {
  title: "Equipment detail",
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

function equipmentLine(room: Room, equipment: Equipment) {
  return (room.equipment ?? []).find(
    (line) =>
      line.equipment_id === equipment.id ||
      line.code.toLowerCase() === equipment.code.toLowerCase(),
  );
}

async function getEquipment(id: string) {
  const api = await serverApi();
  const equipmentResult = await api.GET("/api/v1/equipment/{id}", {
    params: { path: { id } },
  });
  if (equipmentResult.error || !equipmentResult.data) return null;

  const equipment = equipmentResult.data as Equipment;
  const roomsResult = await api.GET("/api/v1/rooms", {
    params: { query: { equipment: equipment.code, limit: 200 } },
  });

  return {
    equipment,
    rooms: roomsResult.error ? [] : ((roomsResult.data?.data ?? []) as Room[]),
  };
}

export default async function AdminEquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getEquipment(id);
  if (!detail) notFound();

  const { equipment, rooms } = detail;
  const totalUnits = rooms.reduce(
    (sum, room) => sum + (equipmentLine(room, equipment)?.quantity ?? 0),
    0,
  );

  return (
    <div className="space-y-7">
      <PageHeader
        icon={Wrench}
        title={equipment.name}
        description={`${equipment.code} equipment profile with images and every room where it is installed.`}
        actions={<DetailBackButton href="/admin/equipment" label="Back to equipment" />}
      />

      <CatalogueDetailHero
        icon={Wrench}
        imageUrl={equipment.image_url}
        galleryUrls={equipment.gallery_urls ?? []}
        imageAlt={`${equipment.name} equipment`}
        fallbackLabel={`${equipment.code} equipment image`}
        stats={[
          {
            label: "Rooms fitted",
            value: rooms.length,
            subtext: "Rooms carrying this item",
            icon: DoorOpen,
            tone: "brand",
          },
          {
            label: "Recorded units",
            value: totalUnits,
            subtext: "Quantity across rooms",
            icon: PackageCheck,
            tone: "success",
          },
          {
            label: "Gallery",
            value: (equipment.gallery_urls ?? []).length,
            subtext: "Supporting images",
            icon: Images,
            tone: "warning",
          },
          {
            label: "Code",
            value: equipment.code,
            subtext: "Filter and import key",
            icon: Hash,
            tone: "info",
          },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{equipment.code}</Badge>
          <Badge variant="outline">Equipment</Badge>
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Equipment profile
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-muted-foreground)]">
          This record powers room filtering and helps administrators recognise
          classroom facilities quickly through images and room attachments.
        </p>
        <dl className="mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-4">
            <dt className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <Hash className="size-4" aria-hidden="true" />
              Code
            </dt>
            <dd className="text-sm font-semibold text-[var(--color-foreground)]">
              {equipment.code}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-4">
            <dt className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <Shapes className="size-4" aria-hidden="true" />
              Catalogue type
            </dt>
            <dd className="text-right text-sm font-semibold text-[var(--color-foreground)]">
              Room facility
            </dd>
          </div>
        </dl>
      </CatalogueDetailHero>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DetailPanel
          title="Equipment metadata"
          description="Identifiers and image counts for this catalogue record."
        >
          <DetailFields
            fields={[
              { label: "Equipment ID", value: equipment.id },
              { label: "Code", value: equipment.code },
              { label: "Name", value: equipment.name },
              { label: "Main image", value: equipment.image_url ? "Added" : "Not added" },
              {
                label: "Gallery images",
                value: (equipment.gallery_urls ?? []).length,
              },
              { label: "Rooms fitted", value: rooms.length },
            ]}
          />
        </DetailPanel>

        <DetailPanel
          title="Rooms using this equipment"
          description="Open the room profile to adjust quantities or inspect other facilities."
        >
          {rooms.length === 0 ? (
            <EmptyInline
              icon={DoorOpen}
              title="No rooms use this equipment yet"
              description="Attach this equipment from a room edit workflow when it exists in a classroom."
            />
          ) : (
            <ul className="grid gap-3">
              {rooms.map((room) => {
                const line = equipmentLine(room, equipment);
                return (
                  <li
                    key={room.id}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] p-3 sm:flex-row sm:items-center"
                  >
                    {room.image_url ? (
                      <img
                        src={room.image_url}
                        alt={`${room.name} room`}
                        className="size-16 rounded-xl border border-[var(--color-border)] object-cover"
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
                        <Badge variant="secondary">{line?.quantity ?? 1}x</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                        {room.room_code} - {ROOM_TYPE_LABELS[room.room_type]} -{" "}
                        {room.capacity} seats
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={route(`/admin/rooms/${room.id}`)}>
                        View room
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DetailPanel>
      </div>
    </div>
  );
}
