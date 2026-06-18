"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";

export function SidebarWrapper() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (pathname?.startsWith("/auth") || pathname?.startsWith("/admin") || pathname?.startsWith("/suspended") || pathname?.startsWith("/onboarding")) return null;

  const userRole = session?.user?.role ?? null;
  if (!userRole) return null;

  const userId = (session?.user as any)?.id;
  const storeName = (session?.user as any)?.storeName;

  return <Sidebar userRole={userRole} userId={userId} storeName={storeName} />;
}
