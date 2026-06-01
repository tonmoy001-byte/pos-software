"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";

export function SidebarWrapper() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  // Hide sidebar on auth pages
  if (pathname?.startsWith("/auth")) return null;
  
  const userRole = session?.user?.role || "CASHIER";
  const userId = (session?.user as any)?.id;
  
  return <Sidebar userRole={userRole} userId={userId} />;
}
