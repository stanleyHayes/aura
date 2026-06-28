/**
 * Typed API client for the CBS Go REST API (Section 8) built on `openapi-fetch`.
 *
 * Responsibilities:
 *  - Attach `Authorization: Bearer <access>` from secure store (Section 9.1).
 *  - Transparently refresh on 401 using the rotating refresh token, with a
 *    single-flight guard so concurrent 401s trigger exactly one refresh
 *    (rotation + reuse-detection semantics, Section 9.1).
 *  - Map RFC 9457 problem+json bodies to {@link ApiError} (Section 8.2).
 *  - Notify the auth layer when the session is irrecoverable (refresh failed /
 *    token family revoked) so the UI can route back to login.
 *
 * TODO(packages): the underlying `paths` type and a thin wrapper should come
 * from the generated `@cbs/api-client` package; kept local for self-containment.
 */
import Constants from 'expo-constants';
import createClient, {
  type Client,
  type Middleware,
} from 'openapi-fetch';

import { LoginResponseSchema } from '@/schemas';

import { toApiError } from './errors';
import type { paths } from './openapi-types';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/lib/secure-store';

export function getApiBaseUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl;
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    fromExtra ??
    'http://localhost:8080/api/v1'
  );
}

/** Called when the session can no longer be recovered (force re-login). */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/* --------------------------------------------------- refresh single-flight */

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Refresh rejected — token rotated/reused/revoked. Hard logout.
        await clearTokens();
        onSessionExpired?.();
        return null;
      }

      const json: unknown = await res.json();
      const parsed = LoginResponseSchema.safeParse(json);
      if (!parsed.success) {
        await clearTokens();
        onSessionExpired?.();
        return null;
      }
      // Persist the rotated pair (new access + new refresh).
      await saveTokens(parsed.data);
      return parsed.data.accessToken;
    } catch {
      // Network failure — keep tokens, surface as a normal failure.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/* --------------------------------------------------------------- middleware */

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await getAccessToken();
    if (token && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },

  async onResponse({ request, response }) {
    // Skip the refresh dance for the auth endpoints themselves.
    const isAuthRoute = /\/auth\/(login|refresh|logout)$/.test(request.url);

    if (response.status === 401 && !isAuthRoute) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retried = new Request(request, {
          headers: new Headers(request.headers),
        });
        retried.headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(retried);
      }
    }
    return response;
  },
};

export const api: Client<paths> = createClient<paths>({
  baseUrl: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});
api.use(authMiddleware);

/**
 * Unwrap an `openapi-fetch` `{ data, error, response }` result, throwing a typed
 * {@link ApiError} on failure. Use this in the React Query layer.
 */
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error);
  }
  // 204 responses legitimately have no body.
  return result.data as T;
}
