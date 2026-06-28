/**
 * React Query hooks over the typed API client. These are the single point the
 * screens consume; they keep `unwrap`/error mapping and cache invalidation in
 * one place.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type {
  AvailabilityResult,
  AvailabilitySearch,
  BookingDetail,
  BookingRequest,
  BookingSummary,
  Building,
  CalendarBlock,
  Equipment,
  Notification,
  Room,
} from '@/schemas';

import { api, unwrap } from './client';
import { queryKeys } from './keys';
import { isoToInstitutionDateTime } from '@/lib/datetime';

/* ----------------------------------------------------------------- lookups */

export function useBuildings() {
  return useQuery({
    queryKey: queryKeys.buildings,
    queryFn: async (): Promise<Building[]> => {
      const res = await api.GET('/buildings');
      return unwrap(res).data;
    },
  });
}

export function useEquipment() {
  return useQuery({
    queryKey: queryKeys.equipment,
    queryFn: async (): Promise<Equipment[]> => {
      const res = await api.GET('/equipment');
      return unwrap(res).data;
    },
  });
}

/* ------------------------------------------------------------ availability */

export function useAvailabilitySearch(
  params: AvailabilitySearch | null,
  enabled = true,
) {
  return useQuery({
    queryKey: params
      ? queryKeys.availability(params)
      : ['availability', 'search', 'idle'],
    enabled: enabled && params != null,
    queryFn: async (): Promise<AvailabilityResult[]> => {
      if (!params) return [];
      const res = await api.GET('/availability/search', {
        params: {
          query: {
            date: params.date,
            start: params.start,
            end: params.end,
            building_id: params.buildingId,
            min_capacity: params.minCapacity,
            room_type: params.roomType,
            equipment: params.equipment?.length
              ? params.equipment.join(',')
              : undefined,
          },
        },
      });
      return unwrap(res).data;
    },
  });
}

/* ---------------------------------------------------------------- bookings */

export function useBookings(scope: 'mine' | 'pending' | 'all') {
  return useQuery({
    queryKey: queryKeys.bookings(scope),
    queryFn: async (): Promise<BookingSummary[]> => {
      const res = await api.GET('/bookings', { params: { query: { scope } } });
      return unwrap(res).data;
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: queryKeys.booking(id),
    enabled: id.length > 0,
    queryFn: async (): Promise<BookingDetail> => {
      const res = await api.GET('/bookings/{id}', {
        params: { path: { id } },
      });
      return unwrap(res);
    },
  });
}

/** FR7 — submit a booking request. Idempotency-Key guards retries (Section 8.1). */
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookingRequest): Promise<BookingDetail> => {
      const startsAt = isoToInstitutionDateTime(input.date, input.start);
      const endsAt = isoToInstitutionDateTime(input.date, input.end);
      const res = await api.POST('/bookings', {
        params: {
          header: { 'Idempotency-Key': cryptoRandomKey() },
        } as never, // header param is optional in the spec; cast keeps types lean.
        body: {
          roomId: input.roomId,
          startsAt,
          endsAt,
          purpose: input.purpose,
          attendeeCount: input.attendeeCount,
        },
      });
      return unwrap(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

export function useApproveBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; note?: string }) => {
      const res = await api.POST('/bookings/{id}/approve', {
        params: { path: { id: vars.id } },
        body: vars.note ? { note: vars.note } : undefined,
      });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: queryKeys.booking(vars.id) });
      void qc.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

export function useRejectBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; note: string }) => {
      const res = await api.POST('/bookings/{id}/reject', {
        params: { path: { id: vars.id } },
        body: { note: vars.note },
      });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: queryKeys.booking(vars.id) });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; note?: string }) => {
      const res = await api.POST('/bookings/{id}/cancel', {
        params: { path: { id: vars.id } },
        body: vars.note ? { note: vars.note } : undefined,
      });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: queryKeys.booking(vars.id) });
      void qc.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

/* ---------------------------------------------------------------- calendar */

export function useCalendar(
  view: 'day' | 'week' | 'month',
  date: string,
  roomId?: string,
) {
  return useQuery({
    queryKey: queryKeys.calendar(view, date, roomId),
    queryFn: async (): Promise<CalendarBlock[]> => {
      const res = await api.GET('/calendar', {
        params: { query: { view, date, room_id: roomId } },
      });
      return unwrap(res).data;
    },
  });
}

/* ----------------------------------------------------------- notifications */

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: queryKeys.notifications(unreadOnly),
    queryFn: async (): Promise<Notification[]> => {
      const res = await api.GET('/notifications', {
        params: { query: { unread: unreadOnly || undefined } },
      });
      return unwrap(res).data;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.POST('/notifications/{id}/read', {
        params: { path: { id } },
      });
      return unwrap(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.POST('/notifications/read-all');
      return unwrap(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/* --------------------------------------------------------------- internals */

/** RoomType label is re-exported here for convenience in result lists. */
export type { Room };

function cryptoRandomKey(): string {
  // 128-bit hex. `globalThis.crypto` is available in the RN/Hermes runtime.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
