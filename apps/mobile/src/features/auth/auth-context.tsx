/**
 * Authentication context — the single source of truth for the signed-in user
 * and session lifecycle on mobile (Section 9.1 / 13).
 *
 *  - Login posts credentials (+ optional MFA code) and stores the bearer
 *    access/refresh pair in SecureStore.
 *  - Lockout/backoff is server-driven (Section 9.1); we surface the RFC 9457
 *    `ACCOUNT_LOCKED` problem to the UI.
 *  - On cold start we restore the session from SecureStore, optionally gated by
 *    a biometric unlock (Section 13).
 *  - Refresh-token rotation/reuse-detection is handled in the API client; when
 *    it fails irrecoverably we are notified and force re-login.
 */
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, setSessionExpiredHandler, unwrap } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import { authenticateBiometric, getBiometricPref } from '@/lib/biometrics';
import { registerForPushNotifications } from '@/lib/push';
import {
  clearTokens,
  getRefreshToken,
  hasSession,
  saveTokens,
} from '@/lib/secure-store';
import { LoginResponseSchema, MeSchema, type Me } from '@/schemas';

interface LoginInput {
  email: string;
  password: string;
  mfaCode?: string;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: Me | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const router = useRouter();
  const mounted = useRef(true);

  const fetchMe = useCallback(async (): Promise<Me | null> => {
    try {
      const res = await api.GET('/auth/me');
      const parsed = MeSchema.parse(unwrap(res));
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const hardLogout = useCallback(async () => {
    await clearTokens();
    queryClient.clear();
    if (mounted.current) {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  // Wire the API client's "session expired" callback to a forced logout.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void hardLogout();
    });
    return () => setSessionExpiredHandler(null);
  }, [hardLogout]);

  // Cold-start session restoration (with optional biometric gate).
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      if (!(await hasSession())) {
        if (mounted.current) setStatus('unauthenticated');
        return;
      }

      if (await getBiometricPref()) {
        const ok = await authenticateBiometric('Unlock AURA');
        if (!ok) {
          // Keep the session but stay locked out of the UI until they unlock.
          if (mounted.current) setStatus('unauthenticated');
          return;
        }
      }

      const me = await fetchMe();
      if (!mounted.current) return;
      if (me) {
        setUser(me);
        setStatus('authenticated');
        void registerForPushNotifications();
      } else {
        await hardLogout();
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [fetchMe, hardLogout]);

  const login = useCallback(
    async ({ email, password, mfaCode }: LoginInput) => {
      const res = await api.POST('/auth/login', {
        body: { email, password, mfa_code: mfaCode },
      });
      // unwrap throws a typed ApiError (incl. ACCOUNT_LOCKED) on failure.
      const data = LoginResponseSchema.parse(unwrap(res));
      await saveTokens(data);

      const me = data.user ?? (await fetchMe());
      if (!me) throw new ApiError('Could not load your profile.', 500);

      setUser(me);
      setStatus('authenticated');
      void registerForPushNotifications();
      router.replace('/');
    },
    [fetchMe, router],
  );

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await api.POST('/auth/logout', { body: { refresh_token: refreshToken } });
      } catch {
        // Best-effort revocation; clear locally regardless.
      }
    }
    await hardLogout();
    router.replace('/(auth)/login');
  }, [hardLogout, router]);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    if (me) setUser(me);
  }, [fetchMe]);

  const value = useMemo<AuthState>(
    () => ({ status, user, login, logout, refreshUser }),
    [status, user, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Convenience: does the user hold a given permission (Section 9.4)? */
export function useHasPermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions.includes(permission) ?? false;
}

/** Convenience: is the signed-in user a booking officer or higher? */
export function useIsOfficer(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return (
    user.role === 'BOOKING_OFFICER' ||
    user.role === 'SYSTEM_ADMIN' ||
    user.permissions.includes('booking.approve')
  );
}
