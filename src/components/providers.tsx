"use client";

import { SessionProvider } from "next-auth/react";
import { TrialGuardProvider } from "@/components/trial/TrialGuardProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TrialGuardProvider>{children}</TrialGuardProvider>
    </SessionProvider>
  );
}
