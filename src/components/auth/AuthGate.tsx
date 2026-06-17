"use client";

import { useSession } from "next-auth/react";
import { FullScreenLoader } from "./FullScreenLoader";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
