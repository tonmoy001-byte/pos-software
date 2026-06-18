import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      plan: { select: { id: true, name: true, displayName: true, maxProducts: true, maxUsers: true, maxBranches: true } },
      store: { select: { id: true, name: true, status: true, email: true, phone: true } },
    },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json({ subscription });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { planId, status, trialEndsAt } = body;

  const data: any = {};
  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    data.planId = planId;
  }
  if (status) {
    const validStatuses = ["TRIAL", "ACTIVE", "CANCELLED", "EXPIRED", "GRACE_PERIOD", "SUSPENDED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
  }
  if (trialEndsAt) {
    data.trialEndsAt = new Date(trialEndsAt);
  }

  const subscription = await prisma.subscription.update({
    where: { id },
    data,
    include: {
      plan: { select: { id: true, name: true, displayName: true } },
      store: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ subscription });
}
