"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SafeUser } from "@/lib/auth";
import { AppShell } from "./AppShell";
import { useDataCache } from "./DataCacheContext";

interface ShellMetaInput {
  user?: SafeUser;
  companyName?: string;
  pendingCount?: number;
  onRefresh?: () => void;
}

interface ProtectedShellContextValue {
  user: SafeUser;
  syncShellMeta: (meta: ShellMetaInput) => void;
}

const ProtectedShellContext = createContext<ProtectedShellContextValue | null>(null);

/**
 * Shared client shell mounted once inside `(protected)/layout.tsx`
 * so switching tabs preserves AppShell and eliminates layout remount delay.
 */
export function ProtectedShell({
  initialUser,
  children,
}: {
  initialUser: SafeUser;
  children: React.ReactNode;
}) {
  const { prefetchQuery } = useDataCache();
  const [userOverride, setUserOverride] = useState<SafeUser | null>(null);
  const [companyName, setCompanyName] = useState("TalentaZ 2.0");
  const [pendingCount, setPendingCount] = useState(0);
  const refreshHandlerRef = useRef<(() => void) | undefined>(undefined);
  const user = userOverride ?? initialUser;

  // Warm primary attendance endpoint once after initial paint settles.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      prefetchQuery(
        "attendances:q=&s=all&d=&p=1",
        "/api/attendances?q=&status=all&date=&page=1&limit=10"
      );
    }, 650);
    return () => window.clearTimeout(timer);
  }, [prefetchQuery]);

  const syncShellMeta = useCallback((meta: ShellMetaInput) => {
    if (meta.user) {
      setUserOverride(meta.user);
    }
    if (meta.companyName) {
      setCompanyName(meta.companyName);
    }
    if (typeof meta.pendingCount === "number") {
      setPendingCount(meta.pendingCount);
    }
    if (meta.onRefresh) {
      refreshHandlerRef.current = meta.onRefresh;
    }
  }, []);

  const handleRefresh = useCallback(() => {
    refreshHandlerRef.current?.();
  }, []);

  const contextValue = useMemo(
    () => ({ user, syncShellMeta }),
    [syncShellMeta, user]
  );

  return (
    <ProtectedShellContext.Provider value={contextValue}>
      <AppShell
        user={user}
        companyName={companyName}
        pendingCount={pendingCount}
        onRefresh={handleRefresh}
      >
        {children}
      </AppShell>
    </ProtectedShellContext.Provider>
  );
}

export function useProtectedShell(): ProtectedShellContextValue {
  const ctx = useContext(ProtectedShellContext);
  if (!ctx) {
    throw new Error("useProtectedShell harus digunakan di dalam ProtectedShell");
  }
  return ctx;
}

/**
 * Syncs page-level header metadata and refresh handler to the persistent AppShell.
 */
export function useSyncShellMeta(meta: ShellMetaInput) {
  const { syncShellMeta } = useProtectedShell();
  const refreshRef = useRef(meta.onRefresh);

  useEffect(() => {
    refreshRef.current = meta.onRefresh;
  }, [meta.onRefresh]);

  useEffect(() => {
    syncShellMeta({
      user: meta.user,
      companyName: meta.companyName,
      pendingCount: meta.pendingCount,
      onRefresh: () => refreshRef.current?.(),
    });
  }, [meta.companyName, meta.pendingCount, meta.user, syncShellMeta]);
}
