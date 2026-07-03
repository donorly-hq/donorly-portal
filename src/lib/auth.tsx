"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { clearSession, loadSession, saveSession } from "./session";
import type { AuthSession } from "./types";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string, organizationSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(loadSession());
    setLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string, organizationSlug?: string) => {
      const result = await api.post<AuthSession>(
        "/auth/login",
        { email, password, organizationSlug: organizationSlug || undefined },
        false,
      );
      saveSession(result);
      setSession(result);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* best effort */
    }
    clearSession();
    setSession(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!session) return false;
      if (session.platformAdmin) return true;
      return session.permissions.includes(permission);
    },
    [session],
  );

  const value = useMemo(
    () => ({ session, loading, login, logout, hasPermission }),
    [session, loading, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
