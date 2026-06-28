/**
 * Booking detail / status timeline (Section 10.3). Reached from My bookings, the
 * approvals queue, or a push-notification deep link (`cbs://booking/<id>`).
 *
 * Shows the booking state machine progress (Section 7.2), the review note, and
 * role-appropriate actions: requesters can cancel PENDING/APPROVED; approved
 * bookings can be added to the device calendar (expo-calendar).
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { messageFromError } from '@/api/errors';
import { useBooking, useCancelBooking } from '@/api/hooks';
import {
  Button,
  Card,
  LoadingScreen,
  ScreenMessage,
  StatusBadge,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { addBookingToCalendar } from '@/lib/device-calendar';
import { formatDate, formatDateTime, formatTime } from '@/lib/datetime';
import type { BookingStatus } from '@/schemas';

const TIMELINE: { status: BookingStatus; label: string }[] = [
  { status: 'PENDING', label: 'Submitted' },
  { status: 'APPROVED', label: 'Approved' },
];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Array.isArray(id) ? id[0] : (id ?? '');
  const { data: booking, isLoading, isError, error } = useBooking(bookingId);
  const cancel = useCancelBooking();
  const { user } = useAuth();

  if (isLoading) return <LoadingScreen label="Loading booking…" />;
  if (isError || !booking) {
    return (
      <ScreenMessage
        title="Could not load booking"
        message={messageFromError(error)}
      />
    );
  }

  const isOwner = user?.id === booking.requestedBy;
  const canCancel =
    isOwner && (booking.status === 'PENDING' || booking.status === 'APPROVED');
  const canAddToCalendar = booking.status === 'APPROVED';

  function confirmCancel() {
    Alert.alert('Cancel booking', 'This cannot be undone. Continue?', [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(
            { id: bookingId },
            {
              onError: (err) =>
                Alert.alert('Could not cancel', messageFromError(err)),
            },
          ),
      },
    ]);
  }

  async function onAddToCalendar() {
    if (!booking) return;
    try {
      const eventId = await addBookingToCalendar({
        title: `Room booking: ${booking.room?.name ?? booking.room?.roomCode ?? ''}`,
        notes: booking.purpose,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        location: booking.room?.roomCode,
      });
      Alert.alert(
        eventId ? 'Added to calendar' : 'Not added',
        eventId
          ? 'This booking is now in your device calendar.'
          : 'Calendar permission was denied or no calendar is available.',
      );
    } catch (err) {
      Alert.alert('Calendar error', messageFromError(err));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: booking.room?.roomCode ?? 'Booking' }} />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="gap-4 p-4"
      >
        <Card className="gap-2">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-0.5">
              <Text className="text-xl font-bold text-foreground">
                {booking.room?.name ?? booking.room?.roomCode ?? 'Room'}
              </Text>
              {booking.room?.building ? (
                <Text className="text-sm text-muted">
                  {booking.room.building.name}
                </Text>
              ) : null}
            </View>
            <StatusBadge status={booking.status} />
          </View>
        </Card>

        <Card className="gap-3">
          <DetailRow label="Date" value={formatDate(booking.startsAt)} />
          <DetailRow
            label="Time"
            value={`${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`}
          />
          <DetailRow label="Attendees" value={String(booking.attendeeCount)} />
          <DetailRow label="Purpose" value={booking.purpose} />
          {booking.requesterName ? (
            <DetailRow label="Requested by" value={booking.requesterName} />
          ) : null}
        </Card>

        {/* Status timeline (Section 7.2). */}
        <Card className="gap-3">
          <Text className="text-xs font-medium uppercase text-muted">
            Progress
          </Text>
          <Timeline status={booking.status} />
          {booking.reviewNote ? (
            <View className="rounded-md bg-surface p-3">
              <Text className="text-xs font-medium uppercase text-muted">
                Officer note
              </Text>
              <Text className="text-sm text-foreground">{booking.reviewNote}</Text>
            </View>
          ) : null}
          {booking.reviewedAt ? (
            <Text className="text-xs text-muted">
              Reviewed {formatDateTime(booking.reviewedAt)}
            </Text>
          ) : null}
        </Card>

        <View className="gap-3">
          {canAddToCalendar ? (
            <Button
              label="Add to calendar"
              variant="secondary"
              onPress={() => void onAddToCalendar()}
            />
          ) : null}
          {canCancel ? (
            <Button
              label="Cancel booking"
              variant="danger"
              loading={cancel.isPending}
              onPress={confirmCancel}
            />
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-xs font-medium uppercase text-muted">{label}</Text>
      <Text className="text-base text-foreground">{value}</Text>
    </View>
  );
}

/**
 * Minimal status timeline. Terminal states (rejected/cancelled/expired) render
 * as a single resolved step; the happy path shows submitted → approved.
 */
function Timeline({ status }: { status: BookingStatus }) {
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') {
    const label =
      status === 'REJECTED'
        ? 'Rejected'
        : status === 'CANCELLED'
          ? 'Cancelled'
          : 'Expired';
    return (
      <View className="flex-row items-center gap-3">
        <Step done label="Submitted" />
        <Connector done />
        <Step done label={label} tone="muted" />
      </View>
    );
  }

  const approvedReached = status === 'APPROVED';
  return (
    <View className="flex-row items-center gap-3">
      {TIMELINE.map((s, i) => {
        const done = s.status === 'PENDING' || approvedReached;
        return (
          <View key={s.status} className="flex-row items-center gap-3">
            <Step done={done} label={s.label} />
            {i < TIMELINE.length - 1 ? (
              <Connector done={approvedReached} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Step({
  done,
  label,
  tone = 'primary',
}: {
  done: boolean;
  label: string;
  tone?: 'primary' | 'muted';
}) {
  const dot = done
    ? tone === 'muted'
      ? 'bg-slate-400'
      : 'bg-primary'
    : 'bg-border';
  return (
    <View className="items-center gap-1">
      <View className={`h-3 w-3 rounded-full ${dot}`} />
      <Text className={`text-xs ${done ? 'text-foreground' : 'text-muted'}`}>
        {label}
      </Text>
    </View>
  );
}

function Connector({ done }: { done: boolean }) {
  return <View className={`h-0.5 w-8 ${done ? 'bg-primary' : 'bg-border'}`} />;
}
