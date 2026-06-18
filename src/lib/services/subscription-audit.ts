import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus, SubscriptionAuditAction } from "@prisma/client";

export class SubscriptionAuditService {
  static async log(params: {
    storeId: string;
    subscriptionId?: string;
    action: SubscriptionAuditAction;
    previousStatus?: SubscriptionStatus;
    newStatus?: SubscriptionStatus;
    previousPlanId?: string;
    newPlanId?: string;
    performedBy: string;
    performedByType: "ADMIN" | "SHOP_OWNER" | "SYSTEM";
    notes?: string;
  }) {
    return prisma.subscriptionAuditLog.create({ data: params });
  }

  static async getHistory(storeId: string, limit = 50) {
    return prisma.subscriptionAuditLog.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async getHistoryBySubscription(subscriptionId: string, limit = 50) {
    return prisma.subscriptionAuditLog.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
