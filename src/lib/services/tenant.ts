import { prisma } from "@/lib/prisma";

export interface TenantContext {
  storeId: string;
  userId: string;
  role: string;
}

export interface IsolationConfig {
  enforceTenantIsolation: boolean;
  allowCrossStore: boolean;
  superAdminIds: string[];
}

export function isSuperAdmin(userId: string): boolean {
  const superAdmins = process.env.SUPER_ADMIN_IDS?.split(",") ?? [];
  return superAdmins.includes(userId);
}

export function getTenantFilter(storeId?: string, requireStore = true) {
  if (!storeId && requireStore) {
    throw new Error("Store ID is required for tenant isolation");
  }

  if (!storeId) {
    return {};
  }

  return { storeId };
}

export function getAdminFilter(isAdmin?: boolean, storeId?: string) {
  if (isAdmin) {
    return storeId ? { storeId } : {};
  }

  if (!storeId) {
    throw new Error("Store ID is required for non-admin users");
  }

  return { storeId };
}

export async function validateTenantAccess(
  userId: string,
  storeId: string
): Promise<boolean> {
  if (isSuperAdmin(userId)) {
    return true;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storeId: true },
  });

  return user?.storeId === storeId;
}

export class TenantService {
  async validateAndGetStoreId(userId: string, requestedStoreId?: string): Promise<string> {
    if (isSuperAdmin(userId) && requestedStoreId) {
      const store = await prisma.store.findUnique({
        where: { id: requestedStoreId },
        select: { id: true },
      });
      if (!store) throw new Error("Store not found");
      return requestedStoreId;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storeId: true, role: true },
    });

    if (!user) throw new Error("User not found");
    if (requestedStoreId && user.storeId !== requestedStoreId) {
      throw new Error("Access denied to requested store");
    }

    return user.storeId;
  }

  async getStoresForUser(userId: string): Promise<{ id: string; name: string }[]> {
    if (isSuperAdmin(userId)) {
      return prisma.store.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storeId: true },
    });

    if (!user) return [];

    const store = await prisma.store.findUnique({
      where: { id: user.storeId },
      select: { id: true, name: true },
    });

    return store ? [store] : [];
  }

  async getActiveStoreId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storeId: true },
    });

    return user?.storeId ?? null;
  }
}

export const tenantService = new TenantService();

export function createTenantMiddleware(storeIdGetter: (userId: string) => Promise<string>) {
  return async function tenantMiddleware(userId: string): Promise<string> {
    return storeIdGetter(userId);
  };
}