"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { safeFetch } from "@/lib/api-client";
import { TrialExpiredModal } from "./TrialExpiredModal";

interface TrialStatusResponse {
  status: string;
  isExpired: boolean;
  canWrite: boolean;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  reason: string | null;
  gracePeriodEnds: string | null;
  graceDaysRemaining: number | null;
}

interface TrialGuardContextType {
  status: string | null;
  isExpired: boolean;
  canWrite: boolean;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  reason: string | null;
  gracePeriodEnds: string | null;
  graceDaysRemaining: number | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const TrialGuardContext = createContext<TrialGuardContextType | null>(null);

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function TrialGuardProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [state, setState] = useState<TrialStatusResponse>({
    status: "",
    isExpired: false,
    canWrite: true,
    daysRemaining: null,
    trialEndsAt: null,
    reason: null,
    gracePeriodEnds: null,
    graceDaysRemaining: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const userId = (session?.user as any)?.id as string | undefined;

  const isSuperAdmin = (() => {
    if (!userId) return false;
    const ids = process.env.NEXT_PUBLIC_SUPER_ADMIN_IDS || "";
    return ids.split(",").includes(userId);
  })();

  const refresh = useCallback(async () => {
    try {
      const data = await safeFetch<TrialStatusResponse>("/api/trial/status");
      setState(data);
    } catch (err) {
      console.error("Failed to fetch trial status:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId || isSuperAdmin) {
      setIsLoading(false);
      return;
    }

    refresh();

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, isSuperAdmin, refresh]);

  const contextValue: TrialGuardContextType = {
    status: isSuperAdmin ? "active" : state.status,
    isExpired: isSuperAdmin ? false : state.isExpired,
    canWrite: isSuperAdmin ? true : state.canWrite,
    daysRemaining: isSuperAdmin ? null : state.daysRemaining,
    trialEndsAt: isSuperAdmin ? null : state.trialEndsAt,
    reason: isSuperAdmin ? null : state.reason,
    gracePeriodEnds: isSuperAdmin ? null : state.gracePeriodEnds,
    graceDaysRemaining: isSuperAdmin ? null : state.graceDaysRemaining,
    isLoading,
    refresh,
  };

  return (
    <TrialGuardContext.Provider value={contextValue}>
      {children}
      {!isSuperAdmin && !isLoading && state.isExpired && (
        <TrialExpiredModal isOpen={true} trialEndsAt={new Date(state.trialEndsAt ?? Date.now())} />
      )}
    </TrialGuardContext.Provider>
  );
}

export function useTrialGuard(): TrialGuardContextType {
  const ctx = useContext(TrialGuardContext);
  if (!ctx) {
    throw new Error("useTrialGuard must be used within a TrialGuardProvider");
  }
  return ctx;
}
