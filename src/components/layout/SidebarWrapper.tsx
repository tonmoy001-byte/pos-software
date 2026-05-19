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
  
  return <Sidebar userRole={userRole} />;
}
