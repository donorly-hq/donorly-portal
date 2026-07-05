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
import type { AuthSession, LoginResponse, MeResponse, OrgChoice } from "./types";

export interface LoginResult {
  otpRequired: boolean;
  challengeId?: string;
  orgSelectionRequired?: boolean;
  organizations?: OrgChoice[];
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string, organizationSlug?: string) => Promise<LoginResult>;
  verifyOtp: (challengeId: string, code: string) => Promise<void>;
  selectOrg: (challengeId: string, organizationId: string) => Promise<void>;
  switchOrg: (organizationId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshBranding: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function mergeMeIntoSession(base: AuthSession): Promise<AuthSession> {
  try {
    const me = await api.get<MeResponse>("/auth/me");
    return {
      ...base,
      userId: me.userId,
      fullName: me.fullName,
      platformAdmin: me.platformAdmin,
      organizationId: me.organizationId,
      organizationName: me.organizationName,
      organizationPrimaryColor: me.organizationPrimaryColor,
      organizationLogo: me.organizationLogo,
      roleCode: me.roleCode,
      permissions: me.permissions,
    };
  } catch {
    return base;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setLoading(false);
      return;
    }
    mergeMeIntoSession(stored)
      .then((merged) => {
        saveSession(merged);
        setSession(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string, organizationSlug?: string): Promise<LoginResult> => {
      const result = await api.post<LoginResponse>(
        "/auth/login",
        { email, password, organizationSlug: organizationSlug || undefined },
        false,
      );
      if (result.otpRequired) {
        return { otpRequired: true, challengeId: result.challengeId ?? undefined };
      }
      if (result.orgSelectionRequired) {
        return {
          otpRequired: false,
          orgSelectionRequired: true,
          challengeId: result.challengeId ?? undefined,
          organizations: result.organizations ?? [],
        };
      }
      saveSession(result);
      setSession(result);
      return { otpRequired: false };
    },
    [],
  );

  const verifyOtp = useCallback(async (challengeId: string, code: string) => {
    const result = await api.post<LoginResponse>("/auth/verify-otp", { challengeId, code }, false);
    saveSession(result);
    setSession(result);
  }, []);

  const selectOrg = useCallback(async (challengeId: string, organizationId: string) => {
    const result = await api.post<LoginResponse>(
      "/auth/select-org",
      { challengeId, organizationId },
      false,
    );
    saveSession(result);
    setSession(result);
  }, []);

  const switchOrg = useCallback(async (organizationId: string) => {
    const result = await api.post<LoginResponse>("/auth/switch-org", { organizationId });
    saveSession(result);
    setSession(result);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* best effort */
    }
    clearSession();
    setSession(null);
  }, []);

  const refreshBranding = useCallback(async () => {
    const stored = loadSession();
    if (!stored) return;
    const merged = await mergeMeIntoSession(stored);
    saveSession(merged);
    setSession(merged);
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
    () => ({ session, loading, login, verifyOtp, selectOrg, switchOrg, logout, refreshBranding, hasPermission }),
    [session, loading, login, verifyOtp, selectOrg, switchOrg, logout, refreshBranding, hasPermission],
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
