/**
 * Availability results (FR6 / 10.3). Lists rooms free for the entire requested
 * window, showing capacity, equipment and the free sub-intervals from the
 * availability engine (Section 7.1). "Book this slot" carries the room + window
 * into the request form.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

import { useAvailabilitySearch } from '@/api/hooks';
import { messageFromError } from '@/api/errors';
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
  if (!data || data.length === 0) {
    return (
      <ScreenMessage
        title="No rooms free"
        message="No rooms are free for that entire window. Try a shorter slot, a different time, or relax your filters."
      />
    );
  }

  return (
    <FlatList
      className="flex-1 bg-surface"
      contentContainerClassName="gap-3 p-4"
      data={data}
      keyExtractor={(item) => item.room.id}
      renderItem={({ item }) => (
        <ResultCard result={item} query={query} />
      )}
    />
  );
}

function ResultCard({
  result,
  query,
}: {
  result: AvailabilityResult;
  query: AvailabilitySearch;
}) {
  const { room, capacity, freeIntervals } = result;
  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-semibold text-foreground">
            {room.name}
          </Text>
          <Text className="text-sm text-muted">
            {room.roomCode}
            {room.building ? ` · ${room.building.code}` : ''}
          </Text>
        </View>
        <Pill text={`Seats ${capacity}`} />
      </View>

      {room.equipment.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {room.equipment.map((e) => (
            <View
              key={e.id}
              className="rounded-full bg-surface px-2 py-1 border border-border"
            >
              <Text className="text-xs text-foreground">
                {e.name}
                {e.quantity > 1 ? ` ×${e.quantity}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-1">
        <Text className="text-xs font-medium uppercase text-muted">
          Free intervals
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {freeIntervals.map((iv) => (
            <View
              key={`${iv.start}-${iv.end}`}
              className="rounded-md bg-green-100 px-2 py-1"
            >
              <Text className="text-xs font-medium text-green-800">
                {iv.start}–{iv.end}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Button
        label="Book this slot"
        onPress={() =>
          router.push({
            pathname: '/(requester)/search/request',
            params: {
              roomId: room.id,
              roomName: room.name,
              roomCode: room.roomCode,
              capacity: String(capacity),
              date: query.date,
              start: query.start,
              end: query.end,
            },
          })
        }
      />
    </Card>
  );
}
