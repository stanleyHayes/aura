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
import { RoomImage } from '@/components/booking-bits';
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
  const buildingLabel =
    booking.room?.building?.name ?? booking.room?.buildingName ?? undefined;

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
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <Card className="gap-2">
          {booking.room?.imageUrl ? (
            <RoomImage uri={booking.room.imageUrl} />
          ) : null}
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-0.5">
              <Text className="text-xl font-bold text-foreground">
                {booking.room?.name ?? booking.room?.roomCode ?? 'Room'}
              </Text>
              {buildingLabel ? (
                <Text className="text-sm text-muted">{buildingLabel}</Text>
              ) : null}
            </View>
            <StatusBadge status={booking.status} />
          </View>
          <Text className="text-sm text-muted">{booking.purpose}</Text>
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
          {booking.reviewerName ? (
            <DetailRow label="Reviewed by" value={booking.reviewerName} />
          ) : null}
        </Card>

        {/* Status timeline (Section 7.2). */}
        <Card className="gap-3">
          <Text className="text-xs font-medium uppercase text-muted">
            Progress
          </Text>
          <Timeline status={booking.status} />
          {booking.reviewNote ? (
            <View className="rounded-md border border-border bg-muted-bg p-3">
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

function DetailRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="gap-0.5">
      <Text className="text-xs font-medium uppercase text-muted">{label}</Text>
      <Text className="text-base text-foreground">{value}</Text>
    </View>
  );
}

function terminalLabel(status: BookingStatus): string {
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Expired';
}

/**
 * Minimal status timeline. Terminal states (rejected/cancelled/expired) render
 * as a resolved step in the danger tone (parity with the web timeline, which
 * marks these with the rejected colour); the happy path shows submitted →
 * approved.
 */
function Timeline({ status }: Readonly<{ status: BookingStatus }>) {
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') {
    return (
      <View className="flex-row items-center gap-3">
        <Step done label="Submitted" />
        <Connector done />
        <Step done label={terminalLabel(status)} tone="danger" />
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
}: Readonly<{
  done: boolean;
  label: string;
  tone?: 'primary' | 'danger';
}>) {
  let dot = 'bg-border';
  if (done) dot = tone === 'danger' ? 'bg-danger' : 'bg-primary';
  return (
    <View className="items-center gap-1">
      <View className={`h-3 w-3 rounded-full ${dot}`} />
      <Text className={`text-xs ${done ? 'text-foreground' : 'text-muted'}`}>
        {label}
      </Text>
    </View>
  );
}

function Connector({ done }: Readonly<{ done: boolean }>) {
  return <View className={`h-0.5 w-8 ${done ? 'bg-primary' : 'bg-border'}`} />;
}
