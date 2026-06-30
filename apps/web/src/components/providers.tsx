"use client";

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import { TooltipProvider } from "@cbs/ui/components/tooltip";
import { ToastProvider } from "@cbs/ui/components/toast";
import { ApiError } from "@cbs/api-client";
import { SessionProvider } from "@/components/session-provider";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";
import type { AppSession } from "@/lib/session-types";

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    retry: (failureCount, error) => {
      // Don't retry auth/permission/validation problems (§8.2).
      if (error instanceof ApiError && error.status < 500) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  },
};

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AppSession | null;
}) {
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <TooltipProvider delayDuration={200}>
          <ThemePreferenceSync />
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
