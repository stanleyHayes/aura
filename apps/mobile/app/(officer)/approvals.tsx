/**
 * Booking officer approvals queue (FR9, Section 7.4 / 10.3). Lists PENDING
 * requests; each can be approved (optional note) or rejected (note required —
 * Section 8.3). Approval may fail with `SLOT_NO_LONGER_AVAILABLE` if another
 * officer won the race (Section 7.3) — that 409 is surfaced inline.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFromError } from '@/api/errors';
import {
  useApproveBooking,
  useBookings,
  useRejectBooking,
} from '@/api/hooks';
import { Button, Card, LoadingScreen, Pill, ScreenMessage } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/datetime';
import { useThemeColors } from '@/theme/theme-context';
import type { BookingSummary } from '@/schemas';

export default function ApprovalsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useBookings('pending');
  const approve = useApproveBooking();
  const reject = useRejectBooking();
  const colors = useThemeColors();

  const [rejecting, setRejecting] = useState<BookingSummary | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  if (isLoading) return <LoadingScreen label="Loading approvals…" />;
  if (isError) {
    return (
      <ScreenMessage title="Could not load" message={messageFromError(error)} />
    );
  }
  if (!data || data.length === 0) {
    return (
      <ScreenMessage
        title="All clear"
        message="There are no pending requests to review."
      />
    );
  }

  function onApprove(booking: BookingSummary) {
    approve.mutate(
      { id: booking.id },
      {
        onError: (err) =>
          Alert.alert('Could not approve', messageFromError(err)),
      },
    );
  }

  function submitReject() {
    if (!rejecting) return;
    if (rejectNote.trim().length < 3) {
      setRejectError('A note is required when rejecting.');
      return;
    }
    reject.mutate(
      { id: rejecting.id, note: rejectNote.trim() },
      {
        onSuccess: () => {
          setRejecting(null);
          setRejectNote('');
          setRejectError(null);
        },
        onError: (err) => setRejectError(messageFromError(err)),
      },
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        contentContainerClassName="gap-3 p-4"
        data={data}
        keyExtractor={(b) => b.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
        renderItem={({ item }) => (
          <ApprovalCard
            booking={item}
            approving={approve.isPending && approve.variables?.id === item.id}
            onApprove={() => onApprove(item)}
            onReject={() => {
              setRejecting(item);
              setRejectNote('');
              setRejectError(null);
            }}
          />
        )}
      />

      <Modal
        visible={rejecting != null}
        animationType="slide"
        transparent
        onRequestClose={() => setRejecting(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <SafeAreaView edges={['bottom']} className="rounded-t-xl bg-background">
            <View className="gap-4 p-5">
              <Text className="text-lg font-semibold text-foreground">
                Reject request
              </Text>
              <Text className="text-sm text-muted">
                Add a note explaining why. The requester will be notified.
              </Text>
              <TextInput
                className="min-h-24 rounded-md border border-border bg-background p-3 text-base text-foreground"
                placeholder="Reason for rejection…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                value={rejectNote}
                onChangeText={setRejectNote}
              />
              {rejectError ? (
                <Text className="text-sm text-danger">{rejectError}</Text>
              ) : null}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => setRejecting(null)}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Confirm reject"
                    variant="danger"
                    loading={reject.isPending}
                    onPress={submitReject}
                  />
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

/**
 * One pending request. Shows enough room + requester context to decide, plus a
 * "why" panel mirroring the web approvals queue: when the API enriches the row
 * with approvability info (`canApprove` / `blockers`), blocked requests list the
 * blockers and the Approve action is disabled until they clear. When the row is
 * a plain booking (no approvability attached) the request is treated as
 * approvable and the panel is hidden — graceful degradation.
 */
function ApprovalCard({
  booking,
  approving,
  onApprove,
  onReject,
}: Readonly<{
  booking: BookingSummary;
  approving: boolean;
  onApprove: () => void;
  onReject: () => void;
}>) {
  // Undefined approvability (plain row) means "no blockers known" → approvable.
  const blocked = booking.canApprove === false;
  const blockers = booking.blockers ?? [];
  const competing = booking.competingPendingCount ?? 0;

  return (
    <Card className="gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/booking/[id]', params: { id: booking.id } })
        }
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-foreground">
              {booking.room?.name ?? booking.room?.roomCode ?? 'Room'}
            </Text>
            <Text className="text-sm text-muted" numberOfLines={2}>
              {booking.purpose}
            </Text>
          </View>
          <View className="items-end gap-1">
            <ApprovabilityBadge blocked={blocked} />
            <Pill text={`${booking.attendeeCount} ppl`} />
          </View>
        </View>
        <Text className="mt-1 text-xs text-muted">
          {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)}–
          {formatTime(booking.endsAt)}
        </Text>
        {booking.requesterName ? (
          <Text className="text-xs text-muted">
            Requested by {booking.requesterName}
          </Text>
        ) : null}
      </Pressable>

      {/* Why panel (parity with the web approvals queue). */}
      {blocked ? (
        <View className="gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-3">
          <Text className="text-xs font-semibold text-danger">
            Needs attention before approval
          </Text>
          {blockers.length > 0 ? (
            blockers.map((b, i) => (
              <Text
                key={`${b.kind}-${i}`}
                className="text-xs text-foreground"
              >
                • {b.message}
                {b.startsAt && b.endsAt
                  ? ` (${formatTime(b.startsAt)}–${formatTime(b.endsAt)})`
                  : ''}
              </Text>
            ))
          ) : (
            <Text className="text-xs text-foreground">
              A conflict prevents approval. Open the request for details.
            </Text>
          )}
        </View>
      ) : competing > 0 ? (
        <View className="rounded-md border border-border bg-muted-bg p-3">
          <Text className="text-xs text-foreground">
            {competing} other pending request{competing === 1 ? '' : 's'} compete
            for this slot. Approving this one supersedes them.
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label="Approve"
            disabled={blocked}
            loading={approving}
            onPress={onApprove}
          />
        </View>
        <View className="flex-1">
          <Button label="Reject" variant="danger" onPress={onReject} />
        </View>
      </View>
    </Card>
  );
}

function ApprovabilityBadge({ blocked }: Readonly<{ blocked: boolean }>) {
  return (
    <View
      className={`self-end rounded-full px-2.5 py-1 ${blocked ? 'bg-danger/15' : 'bg-green-100'}`}
    >
      <Text
        className={`text-xs font-semibold ${blocked ? 'text-danger' : 'text-green-800'}`}
      >
        {blocked ? 'Blocked' : 'Approvable'}
      </Text>
    </View>
  );
}
