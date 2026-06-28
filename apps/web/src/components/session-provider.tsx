"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Permission } from "@cbs/schemas";
import { hasPermission } from "@/lib/auth";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import type { AppSession, AppUser } from "@/lib/session-types";

interface SessionContextValue {
  session: AppSession | null;
  user: AppUser | null;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  isLoading: boolean;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({
  session: initialSession,
  children,
}: {
  session: AppSession | null;
  children: React.ReactNode;
}) {
  // The root layout passes `null` (so public pages stay static). We hydrate the
  // session client-side via /auth/me; React Query caches it. When a server
  // layout already knows the session it is supplied as `initialData`.
  const { data, isLoading } = useQuery({
    queryKey: qk.session,
    initialData: initialSession ?? undefined,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<AppSession | null> => {
      const { data, error } = await api.GET("/api/v1/auth/me");
      if (error || !data) return null;
      return data;
    },
  });

  const session = data ?? null;

  const value = React.useMemo<SessionContextValue>(() => {
    const permissions = (session?.permissions ?? []) as Permission[];
    return {
      session,
      user: session?.user ?? null,
      permissions,
      can: (permission) => hasPermission(permissions, permission),
      isLoading,
    };
  }, [session, isLoading]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
