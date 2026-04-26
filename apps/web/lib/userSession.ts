"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { PublicUser, UserAuthStatus } from "@/lib/apiClient";

export interface UserSessionState {
  status: UserAuthStatus | null;
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Lightweight client-side session hook.
 *
 * Calls `/auth/user/status` once to learn whether the feature is even
 * configured, then `/auth/user/me` to learn whether the visitor has a
 * session. Either call can fail (feature off, or anonymous visitor) — in
 * both cases we degrade silently and treat the visitor as anonymous.
 *
 * Components consume the hook via `useUserSession()`. There's no React
 * context yet (each page that needs auth fetches its own copy) — adding
 * one would only matter if we paid the round-trip more than twice.
 */
export function useUserSession(): UserSessionState {
  const [status, setStatus] = useState<UserAuthStatus | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await apiClient.userAuthStatus();
      setStatus(s);
      if (!s.enabled) {
        setUser(null);
        return;
      }
      try {
        const me = await apiClient.userMe();
        setUser(me.user);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
        } else {
          setUser(null);
        }
      }
    } catch {
      setStatus({ enabled: false, signupEnabled: false });
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiClient.userLogout();
    } catch {
      // best-effort
    }
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, user, loading, refresh, signOut };
}
