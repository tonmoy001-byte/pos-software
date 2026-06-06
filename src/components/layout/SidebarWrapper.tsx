"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";

export function SidebarWrapper() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide sidebar on auth, admin, and suspended pages
  if (pathname?.startsWith("/auth") || pathname?.startsWith("/admin") || pathname?.startsWith("/suspended")) return null;

  const userRole = session?.user?.role || "CASHIER";
  const userId = (session?.user as any)?.id;
  const storeName = (session?.user as any)?.storeName;

  return <Sidebar userRole={userRole} userId={userId} storeName={storeName} />;
}
