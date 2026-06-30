/**
 * Availability search filter form (FR6, Section 7.1 / 10.3). Collects date,
 * window [start, end] and static filters (building, minimum capacity, room type,
 * required equipment) then navigates to the results list.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
  type Equipment,
} from '@/schemas';

type EquipmentChoice = {
  key: string;
  label: string;
  value: string;
  count: number;
};

function normaliseEquipmentName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function equipmentChoices(items: Equipment[]): EquipmentChoice[] {
  const grouped = new Map<string, EquipmentChoice>();
  for (const item of items) {
    const label = (item.name || item.code).trim();
    if (!label) continue;
    const key = normaliseEquipmentName(label);
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(key, { key, label, value: label, count: 1 });
  }
  return Array.from(grouped.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

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
  const equipmentOptions = useMemo(
    () => equipmentChoices(equipment.data ?? []),
    [equipment.data],
  );

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
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-sm font-medium text-foreground">
              Must-have equipment
            </Text>
            <Text className="text-xs leading-5 text-muted">
              Choose only the facilities the room must include.
            </Text>
          </View>
          <View className="rounded-full border border-border px-3 py-1">
            <Text className="text-xs font-medium text-muted">
              {selectedEquipment.length || 'No'} selected
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {equipmentOptions.length ? (
            equipmentOptions.map((option) => (
              <EquipmentChip
                key={option.key}
                label={option.label}
                count={option.count}
                active={selectedEquipment.includes(option.value)}
                onPress={() => toggleEquipment(option.value)}
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

function EquipmentChip({
  label,
  count,
  active,
  onPress,
}: Readonly<{
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`min-h-12 flex-row items-center gap-2 rounded-xl border px-3 py-2 ${active ? 'border-primary bg-primary' : 'border-border bg-card'}`}
    >
      <View
        className={`size-2.5 rounded-full ${active ? 'bg-white' : 'bg-primary-muted'}`}
      />
      <View className="max-w-[180px]">
        <Text
          className={
            active
              ? 'text-sm font-semibold text-primary-foreground'
              : 'text-sm font-semibold text-foreground'
          }
          numberOfLines={1}
        >
          {label}
        </Text>
        {count > 1 ? (
          <Text
            className={
              active
                ? 'text-xs text-primary-foreground opacity-80'
                : 'text-xs text-muted'
            }
            numberOfLines={1}
          >
            {count} variants merged
          </Text>
        ) : null}
      </View>
    </Pressable>
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
