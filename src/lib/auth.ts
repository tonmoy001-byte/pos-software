import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

export function isStaff(user: any) {
  return user?.role === "STAFF" || user?.role === "ADMIN";
}
