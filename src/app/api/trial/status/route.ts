import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";
import { checkAndTransitionSubscription } from "@/lib/services/trialGuard";

export const dynamic = "force-dynamic";

interface TrialStatusResponse {
  status: string;
  trialEndsAt: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
  canWrite: boolean;
  reason?: string;
  gracePeriodEnds: string | null;
  graceDaysRemaining: number | null;
}

export async function GET(): Promise<NextResponse<TrialStatusResponse>> {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { status: "active", trialEndsAt: null, isExpired: false, daysRemaining: null, canWrite: false, reason: "Not authenticated", gracePeriodEnds: null, graceDaysRemaining: null },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const storeId = (session.user as { storeId?: string }).storeId;

  if (isSuperAdmin(userId)) {
    return NextResponse.json({
      status: "active",
      trialEndsAt: null,
      isExpired: false,
      daysRemaining: null,
      canWrite: true,
      gracePeriodEnds: null,
      graceDaysRemaining: null,
    });
  }

  if (!storeId) {
    return NextResponse.json({
      status: "active",
      trialEndsAt: null,
      isExpired: false,
      daysRemaining: null,
      canWrite: false,
      reason: "No store associated with this account",
      gracePeriodEnds: null,
      graceDaysRemaining: null,
    });
  }

  // Auto-transition expired trials to grace period / expired
  await checkAndTransitionSubscription(storeId);

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true, gracePeriodEnds: true },
  });

  if (!subscription) {
    return NextResponse.json({
      status: "active",
      trialEndsAt: null,
      isExpired: false,
      daysRemaining: null,
      canWrite: true,
      gracePeriodEnds: null,
      graceDaysRemaining: null,
    });
  }

  const { status, trialEndsAt, gracePeriodEnds } = subscription;
  const trialEndsAtStr = trialEndsAt ? trialEndsAt.toISOString() : null;
  const gracePeriodEndsStr = gracePeriodEnds ? gracePeriodEnds.toISOString() : null;
  const now = new Date();

  let isExpired = false;
  let daysRemaining: number | null = null;
  let canWrite = true;
  let reason: string | undefined;
  let graceDaysRemaining: number | null = null;

  if (status === "TRIAL" && trialEndsAt) {
    isExpired = now > trialEndsAt;
    const diffMs = trialEndsAt.getTime() - now.getTime();
    daysRemaining = isExpired ? 0 : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    canWrite = !isExpired;
    if (isExpired) {
      reason = "Trial has expired. Please upgrade to continue.";
    }
  } else if (status === "GRACE_PERIOD" && gracePeriodEnds) {
    const graceDiffMs = gracePeriodEnds.getTime() - now.getTime();
    graceDaysRemaining = Math.max(0, Math.ceil(graceDiffMs / (1000 * 60 * 60 * 24)));
    canWrite = false;
    isExpired = true;
    if (now > gracePeriodEnds) {
      reason = "Grace period ended. Subscription expired.";
    } else {
      reason = `Read-only mode. ${graceDaysRemaining} day${graceDaysRemaining === 1 ? "" : "s"} remaining in grace period.`;
    }
  } else if (status === "SUSPENDED") {
    canWrite = false;
    reason = "Store is suspended";
  } else if (status === "CANCELLED") {
    canWrite = false;
    reason = "Subscription has been cancelled";
  } else if (status === "EXPIRED") {
    canWrite = false;
    isExpired = true;
    reason = "Subscription expired. Please renew.";
  }

  return NextResponse.json({
    status,
    trialEndsAt: trialEndsAtStr,
    isExpired,
    daysRemaining,
    canWrite,
    reason,
    gracePeriodEnds: gracePeriodEndsStr,
    graceDaysRemaining,
  });
}
