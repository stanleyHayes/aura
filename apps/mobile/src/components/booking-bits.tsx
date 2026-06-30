/**
 * Small private presentational pieces shared by the requester search / request
 * flow and the booking detail screen. Kept here (not in the shared `ui.tsx`,
 * which another surface owns) because only the booking screens consume them.
 *
 * Everything is theme-aware: colours come from semantic NativeWind classes
 * (`bg-card`, `text-foreground`, `text-muted`, `border-border`) so the pieces
 * recolour under light / dark / every tint, matching the web.
 */
import { Image, Pressable, Text, View } from 'react-native';

import { timeToMinutes } from '@/lib/datetime';
import type { FreeInterval, Room } from '@/schemas';

/* ----------------------------------------------------------------- RoomImage */

/**
 * Room cover image (parity with the web room cards, which now show
 * `image_url`). Falls back to a neutral placeholder tile when a room has no
 * image so cards keep a consistent height.
 */
export function RoomImage({
  uri,
  className = '',
}: {
  uri?: string | null;
  className?: string;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        className={`h-36 w-full rounded-md bg-muted-bg ${className}`}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      className={`h-36 w-full items-center justify-center rounded-md border border-border bg-muted-bg ${className}`}
    >
      <Text className="text-xs uppercase tracking-wide text-muted">
        No photo
      </Text>
    </View>
  );
}

/* ---------------------------------------------------- room type display copy */

export const ROOM_TYPE_LABELS: Record<Room['roomType'], string> = {
  LECTURE_HALL: 'Lecture hall',
  LAB: 'Lab',
  SEMINAR_ROOM: 'Seminar room',
  AUDITORIUM: 'Auditorium',
  CONFERENCE_ROOM: 'Conference room',
};

/* ------------------------------------------------------------- AvailabilitySlots */

/**
 * Native-appropriate availability view (the mobile equivalent of the web
 * availability grid). For a chosen room + day window it lays the requested
 * window out as a row of half-hour slots and marks each free or busy by testing
 * it against the engine's free intervals (§7.1). Tapping a free slot pre-fills
 * the request form with that sub-window.
 *
 * `freeIntervals` carry HH:MM strings on mobile (the API projection the app
 * consumes), so comparisons are done in minutes-of-day.
 */
export function AvailabilitySlots({
  windowStart,
  windowEnd,
  freeIntervals,
  slotMinutes = 30,
  onPick,
}: {
  windowStart: string;
  windowEnd: string;
  freeIntervals: FreeInterval[];
  slotMinutes?: number;
  onPick?: (slot: { start: string; end: string }) => void;
}) {
  const startM = timeToMinutes(windowStart);
  const endM = timeToMinutes(windowEnd);
  if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
    return null;
  }

  const free = freeIntervals.map((iv) => ({
    start: timeToMinutes(iv.start),
    end: timeToMinutes(iv.end),
  }));
  const isFree = (s: number, e: number) =>
    free.some((iv) => iv.start <= s && iv.end >= e);

  const slots: { start: number; end: number; free: boolean }[] = [];
  for (let s = startM; s + slotMinutes <= endM; s += slotMinutes) {
    const e = s + slotMinutes;
    slots.push({ start: s, end: e, free: isFree(s, e) });
  }
  // Tail slot if the window isn't an exact multiple of slotMinutes.
  const last = slots.at(-1);
  if ((last?.end ?? startM) < endM) {
    const s = last?.end ?? startM;
    slots.push({ start: s, end: endM, free: isFree(s, endM) });
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium uppercase text-muted">
          Availability ({fmt(startM)}–{fmt(endM)})
        </Text>
        <View className="flex-row items-center gap-3">
          <Legend swatch="bg-green-500" label="Free" />
          <Legend swatch="bg-muted-bg" label="Busy" />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {slots.map((slot) => {
          const label = `${fmt(slot.start)}`;
          const range = { start: fmt(slot.start), end: fmt(slot.end) };
          if (slot.free) {
            return (
              <Pressable
                key={slot.start}
                accessibilityRole="button"
                accessibilityLabel={`Free ${range.start} to ${range.end}, tap to book`}
                disabled={!onPick}
                onPress={() => onPick?.(range)}
                className="rounded-md border border-green-500 bg-green-500/15 px-2.5 py-1.5 active:opacity-70"
              >
                <Text className="text-xs font-semibold text-green-700">
                  {label}
                </Text>
              </Pressable>
            );
          }
          return (
            <View
              key={slot.start}
              accessibilityLabel={`Busy ${range.start} to ${range.end}`}
              className="rounded-md border border-border bg-muted-bg px-2.5 py-1.5"
            >
              <Text className="text-xs text-muted line-through">{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View className={`h-3 w-3 rounded-sm ${swatch}`} />
      <Text className="text-[10px] text-muted">{label}</Text>
    </View>
  );
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
