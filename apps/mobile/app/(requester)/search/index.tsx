/**
 * Availability search filter form (FR6, Section 7.1 / 10.3). Collects date,
 * window [start, end] and static filters (building, minimum capacity, room type,
 * required equipment) then navigates to the results list.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useBuildings, useEquipment } from '@/api/hooks';
import { Button, Card, Field } from '@/components/ui';
import { ROOM_TYPE_LABELS } from '@/components/booking-bits';
import { todayIso } from '@/lib/datetime';
import {
  AvailabilitySearchSchema,
  RoomType,
  type AvailabilitySearch,
} from '@/schemas';

export default function SearchScreen() {
  const buildings = useBuildings();
  const equipment = useEquipment();
  // Free-text room name/code filter, applied case-insensitively on the results.
  const [text, setText] = useState('');

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AvailabilitySearch>({
    resolver: zodResolver(AvailabilitySearchSchema),
    defaultValues: {
      date: todayIso(),
      start: '09:00',
      end: '11:00',
      buildingId: undefined,
      minCapacity: undefined,
      roomType: undefined,
      equipment: [],
    },
  });

  const selectedBuilding = useWatch({ control, name: 'buildingId' });
  const selectedType = useWatch({ control, name: 'roomType' });
  const selectedEquipment = useWatch({ control, name: 'equipment' }) ?? [];

  const onSubmit = handleSubmit((values) => {
    // Pass the query through as route params; the results screen rebuilds it.
    router.push({
      pathname: '/(requester)/search/results',
      params: {
        date: values.date,
        start: values.start,
        end: values.end,
        buildingId: values.buildingId ?? '',
        minCapacity: values.minCapacity ? String(values.minCapacity) : '',
        roomType: values.roomType ?? '',
        equipment: (values.equipment ?? []).join(','),
        q: text.trim(),
      },
    });
  });

  function toggleEquipment(code: string) {
    const next = selectedEquipment.includes(code)
      ? selectedEquipment.filter((c) => c !== code)
      : [...selectedEquipment, code];
    setValue('equipment', next, { shouldValidate: false });
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <Card className="gap-4">
        <Field
          label="Room name or code"
          placeholder="e.g. Auditorium or NB-201"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Optional — filters results by name or code."
        />

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
                  keyboardType="numbers-and-punctuation"
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
                  keyboardType="numbers-and-punctuation"
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="minCapacity"
          render={({ field: { onChange, value } }) => (
            <Field
              label="Minimum capacity"
              placeholder="e.g. 30"
              keyboardType="number-pad"
              value={value != null ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number.parseInt(t, 10);
                onChange(Number.isFinite(n) ? n : undefined);
              }}
              error={errors.minCapacity?.message}
            />
          )}
        />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-medium text-foreground">Building</Text>
        <View className="flex-row flex-wrap gap-2">
          <ChoiceChip
            label="Any"
            active={!selectedBuilding}
            onPress={() => setValue('buildingId', undefined)}
          />
          {buildings.data?.map((b) => (
            <ChoiceChip
              key={b.id}
              label={b.code}
              active={selectedBuilding === b.id}
              onPress={() => setValue('buildingId', b.id)}
            />
          ))}
        </View>
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-medium text-foreground">Room type</Text>
        <View className="flex-row flex-wrap gap-2">
          <ChoiceChip
            label="Any"
            active={!selectedType}
            onPress={() => setValue('roomType', undefined)}
          />
          {RoomType.options.map((t) => (
            <ChoiceChip
              key={t}
              label={ROOM_TYPE_LABELS[t]}
              active={selectedType === t}
              onPress={() => setValue('roomType', t)}
            />
          ))}
        </View>
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-medium text-foreground">
          Required equipment
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {equipment.data?.length ? (
            equipment.data.map((e) => (
              <ChoiceChip
                key={e.id}
                label={e.name}
                active={selectedEquipment.includes(e.code)}
                onPress={() => toggleEquipment(e.code)}
              />
            ))
          ) : (
            <Text className="text-sm text-muted">No equipment catalogue yet.</Text>
          )}
        </View>
      </Card>

      <Button label="Search rooms" onPress={onSubmit} />
    </ScrollView>
  );
}

function ChoiceChip({
  label,
  active,
  onPress,
}: Readonly<{
  label: string;
  active: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${active ? 'border-primary bg-primary' : 'border-border bg-card'}`}
    >
      <Text
        className={
          active
            ? 'text-sm text-primary-foreground'
            : 'text-sm text-foreground'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
