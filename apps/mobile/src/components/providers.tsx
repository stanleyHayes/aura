/**
 * App-wide providers: React Query (with offline persistence) and auth.
 *
 * The PersistQueryClientProvider restores the last persisted read-only caches
 * (availability, calendar, bookings) so the app shows content offline
 * (Section 13). Mutations are never persisted (see `query-client.ts`).
 */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { type ReactNode } from 'react';

import {
  asyncStoragePersister,
  queryClient,
  shouldDehydrateQueryKey,
} from '@/api/query-client';
import { AuthProvider } from '@/features/auth/auth-context';
import { ThemeProvider } from '@/theme/theme-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: 1000 * 60 * 60 * 24, // 24h
            dehydrateOptions: {
              shouldDehydrateQuery: (query) =>
                query.state.status === 'success' &&
                shouldDehydrateQueryKey(query.queryKey),
            },
          }}
        >
          <AuthProvider>{children}</AuthProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
