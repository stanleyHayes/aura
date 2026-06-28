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
import { palette } from '@/theme/tokens';
import type { BookingSummary } from '@/schemas';

export default function ApprovalsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useBookings('pending');
  const approve = useApproveBooking();
  const reject = useRejectBooking();

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
    <View className="flex-1 bg-surface">
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
          <Card className="gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/booking/[id]', params: { id: item.id } })
              }
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-foreground">
                    {item.room?.name ?? item.room?.roomCode ?? 'Room'}
                  </Text>
                  <Text className="text-sm text-muted" numberOfLines={2}>
                    {item.purpose}
                  </Text>
                </View>
                <Pill text={`${item.attendeeCount} ppl`} />
              </View>
              <Text className="mt-1 text-xs text-muted">
                {formatDate(item.startsAt)} · {formatTime(item.startsAt)}–
                {formatTime(item.endsAt)}
              </Text>
              {item.requesterName ? (
                <Text className="text-xs text-muted">
                  Requested by {item.requesterName}
                </Text>
              ) : null}
            </Pressable>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  label="Approve"
                  loading={approve.isPending && approve.variables?.id === item.id}
                  onPress={() => onApprove(item)}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Reject"
                  variant="danger"
                  onPress={() => {
                    setRejecting(item);
                    setRejectNote('');
                    setRejectError(null);
                  }}
                />
              </View>
            </View>
          </Card>
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
                placeholderTextColor={palette.muted}
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
