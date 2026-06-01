import { prisma } from "@/lib/prisma";

export async function isTrialExpired(storeId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true },
  });

  if (!subscription) return false;
  if (subscription.status === "active") return false;
  if (subscription.status === "cancelled") return true;
  if (subscription.status === "trial" && subscription.trialEndsAt) {
    return new Date() > subscription.trialEndsAt;
  }

  return false;
}

export async function canWrite(storeId: string): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true },
  });

  if (!subscription) return { allowed: true };

  if (subscription.status === "suspended") {
    return { allowed: false, reason: "Store is suspended" };
  }

  if (subscription.status === "trial" && subscription.trialEndsAt) {
    if (new Date() > subscription.trialEndsAt) {
      return { allowed: false, reason: "Trial has expired. Please upgrade to continue." };
    }
  }

  return { allowed: true };
}