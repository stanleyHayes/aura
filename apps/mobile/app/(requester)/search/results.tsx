/**
 * Availability results (FR6 / 10.3). Lists rooms free for the entire requested
 * window — each card mirrors the web room card (cover image, name, code,
 * building, capacity, equipment) and shows a native availability view: the
 * requested window broken into free/busy slots (the mobile equivalent of the
 * web availability grid). Tapping a free slot carries that room + sub-window
 * into the request form.
 *
 * A free-text `q` filter (room name or code) is applied client-side and is
 * deliberately CASE-INSENSITIVE (both sides lower-cased).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

import { useAvailabilitySearch } from '@/api/hooks';
import { messageFromError } from '@/api/errors';
import {
  AvailabilitySlots,
  ROOM_TYPE_LABELS,
  RoomImage,
} from '@/components/booking-bits';
import { Button, Card, LoadingScreen, Pill, ScreenMessage } from '@/components/ui';
import {
  AvailabilitySearchSchema,
  RoomType,
  type AvailabilityResult,
  type AvailabilitySearch,
} from '@/schemas';

function parseParams(
  raw: Record<string, string | string[] | undefined>,
): AvailabilitySearch | null {
  const get = (k: string): string | undefined => {
    const v = raw[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.length > 0 ? s : undefined;
  };
  const equipmentRaw = get('equipment');
  const roomTypeRaw = get('roomType');
  const candidate = {
    date: get('date') ?? '',
    start: get('start') ?? '',
    end: get('end') ?? '',
    buildingId: get('buildingId'),
    minCapacity: get('minCapacity') ? Number(get('minCapacity')) : undefined,
    roomType: roomTypeRaw && RoomType.options.includes(roomTypeRaw as never)
      ? (roomTypeRaw as AvailabilitySearch['roomType'])
      : undefined,
    equipment: equipmentRaw ? equipmentRaw.split(',').filter(Boolean) : undefined,
  };
  const parsed = AvailabilitySearchSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export default function ResultsScreen() {
  const params = useLocalSearchParams();
  const query = parseParams(params);
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = (rawQ ?? '').trim().toLowerCase();
  const { data, isLoading, isError, error } = useAvailabilitySearch(query);

  if (!query) {
    return (
      <ScreenMessage
        title="Invalid search"
        message="Go back and adjust your filters."
      />
    );
  }
  if (isLoading) return <LoadingScreen label="Finding rooms…" />;
  if (isError) {
    return (
      <ScreenMessage title="Search failed" message={messageFromError(error)} />
    );
  }

  // Case-insensitive client-side filter on room name / code.
  const results = (data ?? []).filter((r) => {
    if (!q) return true;
    const name = r.room.name.toLowerCase();
    const code = r.room.roomCode.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  if (results.length === 0) {
    return (
      <ScreenMessage
        title={q ? 'No matching rooms' : 'No rooms free'}
        message={
          q
            ? 'No free rooms match that name or code. Clear the text filter or try a different window.'
            : 'No rooms are free for that entire window. Try a shorter slot, a different time, or relax your filters.'
        }
      />
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 p-4"
      data={results}
      keyExtractor={(item) => item.room.id}
      ListHeaderComponent={
        <Text className="text-sm text-muted">
          {results.length} room{results.length === 1 ? '' : 's'} free for the
          entire window
        </Text>
      }
      renderItem={({ item }) => <ResultCard result={item} query={query} />}
    />
  );
}

function ResultCard({
  result,
  query,
}: Readonly<{
  result: AvailabilityResult;
  query: AvailabilitySearch;
}>) {
  const { room, capacity, freeIntervals } = result;
  const buildingLabel =
    room.building?.code ?? room.buildingCode ?? undefined;

  function book(start: string, end: string) {
    router.push({
      pathname: '/(requester)/search/request',
      params: {
        roomId: room.id,
        roomName: room.name,
        roomCode: room.roomCode,
        imageUrl: room.imageUrl ?? '',
        capacity: String(capacity),
        date: query.date,
        start,
        end,
      },
    });
  }

  return (
    <Card className="gap-3">
      <RoomImage uri={room.imageUrl} />

      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-semibold text-foreground">
            {room.name}
          </Text>
          <Text className="text-sm text-muted">
            {room.roomCode}
            {buildingLabel ? ` · ${buildingLabel}` : ''} ·{' '}
            {ROOM_TYPE_LABELS[room.roomType]}
          </Text>
        </View>
        <Pill text={`Seats ${capacity}`} />
      </View>

      {room.equipment.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {room.equipment.map((e) => (
            <View
              key={e.id}
              className="rounded-full border border-border bg-muted-bg px-2 py-1"
            >
              <Text className="text-xs text-foreground">
                {e.name}
                {e.quantity > 1 ? ` ×${e.quantity}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Native availability view: the requested window as free/busy slots. */}
      <AvailabilitySlots
        windowStart={query.start}
        windowEnd={query.end}
        freeIntervals={freeIntervals}
        onPick={(slot) => book(slot.start, slot.end)}
      />

      <Button
        label="Book this slot"
        onPress={() => book(query.start, query.end)}
      />
    </Card>
  );
}
