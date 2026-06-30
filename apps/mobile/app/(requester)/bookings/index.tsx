/**
 * My bookings (FR7 status tracking, Section 10.3). Lists the requester's
 * bookings with status, tappable through to the detail/timeline screen. Pulls
 * from the persisted cache when offline (read-only, Section 13).
 */
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { messageFromError } from '@/api/errors';
import { useBookings } from '@/api/hooks';
import {
  Card,
  LoadingScreen,
  ScreenMessage,
  StatusBadge,
} from '@/components/ui';
import { formatDate, formatTime } from '@/lib/datetime';
import type { BookingSummary } from '@/schemas';

export default function MyBookingsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useBookings('mine');

  if (isLoading) return <LoadingScreen label="Loading your bookings…" />;
  if (isError) {
    return (
      <ScreenMessage title="Could not load" message={messageFromError(error)} />
    );
  }
  if (!data || data.length === 0) {
    return (
      <ScreenMessage
        title="No bookings yet"
        message="Search for a room to make your first request."
      />
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 p-4"
      data={data}
      keyExtractor={(b) => b.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
      renderItem={({ item }) => <BookingRow booking={item} />}
    />
  );
}

function BookingRow({ booking }: Readonly<{ booking: BookingSummary }>) {
  const buildingLabel =
    booking.room?.building?.name ?? booking.room?.buildingName ?? undefined;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })}
    >
      <Card className="gap-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-foreground">
              {booking.room?.name ?? booking.room?.roomCode ?? 'Room'}
            </Text>
            {buildingLabel ? (
              <Text className="text-xs text-muted">{buildingLabel}</Text>
            ) : null}
            <Text className="text-sm text-muted" numberOfLines={1}>
              {booking.purpose}
            </Text>
          </View>
          <StatusBadge status={booking.status} />
        </View>
        <Text className="text-xs text-muted">
          {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)}–
          {formatTime(booking.endsAt)}
        </Text>
      </Card>
    </Pressable>
  );
}
