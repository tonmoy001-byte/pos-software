import { prisma } from "@/lib/prisma";
import { getSuperAdminIds } from "@/lib/env";

function isSuperAdmin(userId: string): boolean {
  return getSuperAdminIds().includes(userId);
}

export async function isTrialExpired(storeId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true },
  });

  if (!subscription) return false;
  if (subscription.status === "ACTIVE") return false;
  if (subscription.status === "CANCELLED") return true;
  if (subscription.status === "EXPIRED") return true;
  if (subscription.status === "SUSPENDED") return true;
  if (subscription.status === "GRACE_PERIOD") return false; // still allows reads
  if (subscription.status === "TRIAL" && subscription.trialEndsAt) {
    return new Date() > subscription.trialEndsAt;
  }

  return false;
}

export async function canWrite(storeId: string, userId?: string): Promise<{ allowed: boolean; reason?: string }> {
  // Super admins bypass all trial and suspension checks
  if (userId && isSuperAdmin(userId)) {
    return { allowed: true };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true, gracePeriodEnds: true },
  });

  if (!subscription) return { allowed: true };

  if (subscription.status === "SUSPENDED") {
    return { allowed: false, reason: "Store is suspended" };
  }

  if (subscription.status === "CANCELLED") {
    return { allowed: false, reason: "Subscription has been cancelled" };
  }

  if (subscription.status === "EXPIRED") {
    return { allowed: false, reason: "Subscription expired. Please renew." };
  }

  if (subscription.status === "GRACE_PERIOD") {
    if (subscription.gracePeriodEnds && new Date() > subscription.gracePeriodEnds) {
      return { allowed: false, reason: "Grace period ended. Subscription expired. Please renew." };
    }
    return { allowed: false, reason: "Subscription in grace period. Please renew." };
  }

  if (subscription.status === "TRIAL" && subscription.trialEndsAt) {
    if (new Date() > subscription.trialEndsAt) {
      return { allowed: false, reason: "Trial has expired. Please upgrade to continue." };
    }
  }

  return { allowed: true };
}

export async function checkAndTransitionSubscription(storeId: string): Promise<{
  status: string;
  changed: boolean;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true, gracePeriodEnds: true },
  });

  if (!subscription) return { status: "ACTIVE", changed: false };

  const now = new Date();

  // TRIAL → GRACE_PERIOD (if trialEndsAt passed)
  if (subscription.status === "TRIAL" && subscription.trialEndsAt && now > subscription.trialEndsAt) {
    const graceEnds = new Date(now);
    graceEnds.setDate(graceEnds.getDate() + 3);

    await prisma.subscription.update({
      where: { storeId },
      data: { status: "GRACE_PERIOD", gracePeriodEnds: graceEnds },
    });
    return { status: "GRACE_PERIOD", changed: true };
  }

  // GRACE_PERIOD → EXPIRED (if gracePeriodEnds passed)
  if (subscription.status === "GRACE_PERIOD" && subscription.gracePeriodEnds && now > subscription.gracePeriodEnds) {
    await prisma.subscription.update({
      where: { storeId },
      data: { status: "EXPIRED" },
    });
    return { status: "EXPIRED", changed: true };
  }

  return { status: subscription.status, changed: false };
}