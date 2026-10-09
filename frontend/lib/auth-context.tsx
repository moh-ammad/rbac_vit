"use client";

// Who is signed in, loaded from GET /api/me on every app load.
// Permissions and class scope come straight from the database through the API;
// the browser keeps them only in React memory.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Me } from "@/types";

type AuthState = {
  me: Me | null;
  loading: boolean;
  /** true if the user has ANY of the given permissions */
  can: (...permissions: string[]) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: Me }>("/me");
      setMe(user);
    } catch {
      setMe(null);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    api<{ user: Me }>("/me")
      .then(({ user }) => { if (!cancelled) { setMe(user); setLoading(false); } })
      .catch(() => { if (!cancelled) { setMe(null); setLoading(false); router.replace("/login"); } });
    return () => { cancelled = true; };
  }, [router]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setMe(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthState>(() => ({
    me, loading, refresh, logout,
    can: (...permissions) => Boolean(me && permissions.some((p) => me.permissions.includes(p))),
  }), [me, loading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
