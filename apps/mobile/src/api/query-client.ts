/**
 * React Query client + AsyncStorage persistence.
 *
 * Offline strategy (Section 13): "read-only caching of last availability /
 * calendar via React Query persistence; mutations require connectivity." We
 * persist GET-style query caches to AsyncStorage so the last results are shown
 * offline, and we DENY persistence/replay of mutations — booking is inherently
 * online.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — keep lists snappy without hammering the API.
      gcTime: 1000 * 60 * 60 * 24, // 24h so persisted cache survives restarts.
      retry: (failureCount, error) => {
        // Never retry auth / permission / conflict errors.
        if (error instanceof ApiError) {
          if ([401, 403, 404, 409, 422, 423].includes(error.status)) return false;
        }
        return failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations are not persisted/replayed; connectivity required.
      retry: false,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'cbs.react-query-cache',
  throttleTime: 1000,
});

/**
 * Only read-only domain caches are worth persisting for offline viewing.
 * Anything else (and any mutation) is dropped from the persisted snapshot.
 */
const PERSISTED_PREFIXES = ['availability', 'calendar', 'bookings', 'rooms', 'me'];

export function shouldDehydrateQueryKey(key: readonly unknown[]): boolean {
  const head = key[0];
  return typeof head === 'string' && PERSISTED_PREFIXES.includes(head);
}
