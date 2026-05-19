import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

/** Session user shape returned by this app's auth layer */
export interface AppUser extends DefaultSession {
  role: Role;
  storeId: string;
  storeName: string;
}

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user as AppUser | undefined;
}

export function isAdmin(user: AppUser | undefined | null): boolean {
  return user?.role === "ADMIN";
}

export function isStaff(user: AppUser | undefined | null): boolean {
  return user?.role === "MANAGER" || user?.role === "CASHIER" || user?.role === "ADMIN";
}
