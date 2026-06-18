import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

interface TrialStatusResponse {
  status: string;
  trialEndsAt: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
  canWrite: boolean;
  reason?: string;
}

export async function GET(): Promise<NextResponse<TrialStatusResponse>> {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { status: "active", trialEndsAt: null, isExpired: false, daysRemaining: null, canWrite: false, reason: "Not authenticated" },
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
    });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, trialEndsAt: true },
  });

  if (!subscription) {
    return NextResponse.json({
      status: "active",
      trialEndsAt: null,
      isExpired: false,
      daysRemaining: null,
      canWrite: true,
    });
  }

  const { status, trialEndsAt } = subscription;
  const trialEndsAtStr = trialEndsAt ? trialEndsAt.toISOString() : null;
  const now = new Date();

  let isExpired = false;
  let daysRemaining: number | null = null;
  let canWrite = true;
  let reason: string | undefined;

  if (status === "trial" && trialEndsAt) {
    isExpired = now > trialEndsAt;
    const diffMs = trialEndsAt.getTime() - now.getTime();
    daysRemaining = isExpired ? 0 : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    canWrite = !isExpired;
    if (isExpired) {
      reason = "Trial has expired. Please upgrade to continue.";
    }
  } else if (status === "suspended") {
    canWrite = false;
    reason = "Store is suspended";
  } else if (status === "cancelled") {
    canWrite = false;
    reason = "Subscription has been cancelled";
  }

  return NextResponse.json({
    status,
    trialEndsAt: trialEndsAtStr,
    isExpired,
    daysRemaining,
    canWrite,
    reason,
  });
}
