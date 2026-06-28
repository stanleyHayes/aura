/**
 * Availability search filter form (FR6, Section 7.1 / 10.3). Collects date,
 * window [start, end] and static filters (building, minimum capacity, room type,
 * required equipment) then navigates to the results list.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useBuildings, useEquipment } from '@/api/hooks';
import { Button, Card, Field } from '@/components/ui';
import { todayIso } from '@/lib/datetime';
import {
  AvailabilitySearchSchema,
  RoomType,
  type AvailabilitySearch,
} from '@/schemas';

const ROOM_TYPE_LABELS: Record<(typeof RoomType.options)[number], string> = {
  LECTURE_HALL: 'Lecture hall',
  LAB: 'Lab',
  SEMINAR_ROOM: 'Seminar room',
  AUDITORIUM: 'Auditorium',
  CONFERENCE_ROOM: 'Conference room',
};

export default function SearchScreen() {
  const buildings = useBuildings();
  const equipment = useEquipment();

  const {
    control,
    handleSubmit,
    watch,
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

  const selectedBuilding = watch('buildingId');
  const selectedType = watch('roomType');
  const selectedEquipment = watch('equipment') ?? [];

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
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <Card className="gap-4">
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${active ? 'border-primary bg-primary' : 'border-border bg-background'}`}
    >
      <Text className={active ? 'text-sm text-white' : 'text-sm text-foreground'}>
        {label}
      </Text>
    </Pressable>
  );
}
