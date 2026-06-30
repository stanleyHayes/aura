/**
 * Booking request form (FR7, Section 10.3). Pre-filled with the room + window
 * chosen from the results list. Validates client-side against the same
 * invariants the server trigger enforces (Section 6.7): not-in-past, single
 * day, capacity. Submission failures surface RFC 9457 conflict details (FR8 —
 * "immediately notify users of conflicts").
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, Text, View } from 'react-native';

import { useCreateBooking } from '@/api/hooks';
import { ApiError } from '@/api/errors';
import { RoomImage } from '@/components/booking-bits';
import { Button, Card, Field } from '@/components/ui';
import { BookingRequestSchema, type BookingRequest } from '@/schemas';

function str(v: string | string[] | undefined, fallback = ''): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s ?? fallback;
}

export default function RequestScreen() {
  const params = useLocalSearchParams();
  const roomId = str(params.roomId);
  const roomName = str(params.roomName, 'Room');
  const roomCode = str(params.roomCode);
  const imageUrl = str(params.imageUrl);
  const capacity = Number.parseInt(str(params.capacity, '0'), 10);

  const createBooking = useCreateBooking();
  const [conflict, setConflict] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BookingRequest>({
    resolver: zodResolver(BookingRequestSchema),
    defaultValues: {
      roomId,
      date: str(params.date),
      start: str(params.start),
      end: str(params.end),
      purpose: '',
      attendeeCount: 1,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setConflict(null);

    // Client-side capacity guard mirroring BR4 before hitting the network.
    if (capacity > 0 && values.attendeeCount > capacity) {
      setError('attendeeCount', {
        message: `Exceeds room capacity of ${capacity}.`,
      });
      return;
    }

    try {
      const booking = await createBooking.mutateAsync(values);
      router.replace({
        pathname: '/booking/[id]',
        params: { id: booking.id },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        // Field-level validation (400/422).
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in BookingRequestSchema.shape) {
            setError(field as keyof BookingRequest, { message });
          }
        }
        // Hard conflict codes from the trigger / approval race (Section 7.3).
        if (
          err.code === 'CONFLICTS_WITH_LECTURE' ||
          err.code === 'CONFLICTS_WITH_MAINTENANCE' ||
          err.code === 'SLOT_NO_LONGER_AVAILABLE' ||
          err.code === 'BOOKING_IN_PAST'
        ) {
          setConflict(err.message);
          return;
        }
        setConflict(err.message);
        return;
      }
      setConflict('Could not submit. Check your connection and try again.');
    }
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <Card className="gap-2">
        {imageUrl ? <RoomImage uri={imageUrl} /> : null}
        <Text className="text-lg font-semibold text-foreground">{roomName}</Text>
        <Text className="text-sm text-muted">
          {roomCode}
          {capacity > 0 ? ` · seats ${capacity}` : ''}
        </Text>
      </Card>

      <Card className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="date"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  value={value}
                  onChangeText={onChange}
                  error={errors.date?.message}
                  autoCapitalize="none"
                />
              )}
            />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="start"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="From"
                  placeholder="HH:MM"
                  value={value}
                  onChangeText={onChange}
                  error={errors.start?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="end"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="To"
                  placeholder="HH:MM"
                  value={value}
                  onChangeText={onChange}
                  error={errors.end?.message}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="attendeeCount"
          render={({ field: { onChange, value } }) => (
            <Field
              label="Attendees"
              placeholder="e.g. 25"
              keyboardType="number-pad"
              value={value ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number.parseInt(t, 10);
                onChange(Number.isFinite(n) ? n : 0);
              }}
              error={errors.attendeeCount?.message}
              hint={capacity > 0 ? `Room seats up to ${capacity}` : undefined}
            />
          )}
        />

        <Controller
          control={control}
          name="purpose"
          render={({ field: { onChange, value } }) => (
            <Field
              label="Purpose"
              placeholder="e.g. CS401 revision session"
              value={value}
              onChangeText={onChange}
              error={errors.purpose?.message}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </Card>

      {conflict ? (
        <Card className="border-danger bg-danger/10">
          <Text className="text-sm font-medium text-danger">{conflict}</Text>
        </Card>
      ) : null}

      <Button
        label="Submit request"
        loading={createBooking.isPending}
        onPress={onSubmit}
      />
      <Text className="text-center text-xs text-muted">
        Your request will be reviewed by a booking officer. You will be notified
        of the outcome.
      </Text>
    </ScrollView>
  );
}
