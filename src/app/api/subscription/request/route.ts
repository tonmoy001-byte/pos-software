import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/services/tenant";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = session.user?.storeId;
  if (typeof storeId !== "string") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.subscriptionRequest.findMany({
    where: { storeId },
    include: {
      currentPlan: { select: { displayName: true } },
      requestedPlan: { select: { displayName: true, priceMonthly: true, priceYearly: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ requests });
}

const requestSchema = z.object({
  planId: z.string().min(1, "Plan is required"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  paymentMethod: z.string().min(1, "Payment method is required"),
  transactionId: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storeId = session.user?.storeId;
  if (typeof storeId !== "string") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { planId, billingCycle, paymentMethod, transactionId, notes } = parsed.data;

  const plan = await prisma.plan.findFirst({
    where: { id: planId, isActive: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found or inactive" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });
  if (!subscription) {
    return NextResponse.json({ error: "No subscription found for this store" }, { status: 400 });
  }

  const amount = billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

  const existingPending = await prisma.subscriptionRequest.findFirst({
    where: { storeId, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending request. Please wait for it to be reviewed." },
      { status: 400 }
    );
  }

  const request = await prisma.subscriptionRequest.create({
    data: {
      storeId,
      currentPlanId: subscription.planId,
      requestedPlanId: planId,
      paymentMethod,
      transactionId: transactionId || null,
      amountPaid: amount,
      notes: notes || null,
    },
  });

  return NextResponse.json(request, { status: 201 });
}
