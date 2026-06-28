/**
 * Centralised React Query keys. The first element is a stable string prefix
 * used by the persistence allow-list (see `query-client.ts`).
 */
import type { AvailabilitySearch } from '@/schemas';

export const queryKeys = {
  me: ['me'] as const,

  buildings: ['rooms', 'buildings'] as const,
  equipment: ['rooms', 'equipment'] as const,

  availability: (params: AvailabilitySearch) =>
    ['availability', 'search', params] as const,

  bookings: (scope: 'mine' | 'pending' | 'all') =>
    ['bookings', 'list', scope] as const,
  booking: (id: string) => ['bookings', 'detail', id] as const,

  calendar: (view: string, date: string, roomId?: string) =>
    ['calendar', view, date, roomId ?? 'all'] as const,

  notifications: (unreadOnly: boolean) =>
    ['notifications', unreadOnly ? 'unread' : 'all'] as const,
} as const;
