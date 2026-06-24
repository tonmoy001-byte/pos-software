import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

function parseFeatures(raw: string): string[] {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isSuperAdmin(session.user.id)) {
    return NextResponse.json({
      subscription: null,
      plan: null,
      plans: [],
      daysRemaining: null,
      isExpired: false,
    });
  }

  const storeId = session.user?.storeId;
  if (typeof storeId !== "string") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });

  const plans = await prisma.plan.findMany({
    where: { isActive: true, name: { not: "trial" } },
    orderBy: { createdAt: "asc" },
  });

  let daysRemaining: number | null = null;
  let isExpired = false;

  if (subscription) {
    const now = new Date();

    if (subscription.status === "TRIAL" && subscription.trialEndsAt) {
      const diffMs = subscription.trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      isExpired = now > subscription.trialEndsAt;
    } else if (subscription.status === "GRACE_PERIOD" && subscription.gracePeriodEnds) {
      const diffMs = subscription.gracePeriodEnds.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      isExpired = true;
    }
  }

  return NextResponse.json({
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          billingCycle: subscription.billingCycle ?? null,
          subscriptionPrice: subscription.subscriptionPrice ?? null,
          gracePeriodEnds: subscription.gracePeriodEnds?.toISOString() ?? null,
          createdAt: subscription.createdAt.toISOString(),
        }
      : null,
    plan: subscription?.plan
      ? {
          id: subscription.plan.id,
          name: subscription.plan.name,
          displayName: subscription.plan.displayName,
          description: subscription.plan.description,
          maxProducts: subscription.plan.maxProducts,
          maxUsers: subscription.plan.maxUsers,
          maxBranches: subscription.plan.maxBranches,
          features: parseFeatures(subscription.plan.features),
          priceMonthly: subscription.plan.priceMonthly,
          priceYearly: subscription.plan.priceYearly,
          isCustomPricing: subscription.plan.isCustomPricing,
        }
      : null,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      maxProducts: p.maxProducts,
      maxUsers: p.maxUsers,
      maxBranches: p.maxBranches,
      features: parseFeatures(p.features),
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      isCustomPricing: p.isCustomPricing,
    })),
    daysRemaining,
    isExpired,
  });
}
