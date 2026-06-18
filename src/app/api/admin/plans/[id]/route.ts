import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

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
  const { displayName, maxProducts, maxUsers, maxBranches, features, isActive } = body;

  const plan = await prisma.plan.update({
    where: { id },
    data: {
      ...(displayName && { displayName }),
      ...(maxProducts !== undefined && { maxProducts }),
      ...(maxUsers !== undefined && { maxUsers }),
      ...(maxBranches !== undefined && { maxBranches }),
      ...(features && { features: JSON.stringify(features) }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ plan });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const activeSubs = await prisma.subscription.count({
    where: { planId: id, status: { in: ["TRIAL", "ACTIVE"] } },
  });

  if (activeSubs > 0) {
    return NextResponse.json(
      { error: "Cannot delete plan with active subscriptions" },
      { status: 400 }
    );
  }

  await prisma.plan.delete({ where: { id } });

  return NextResponse.json({ success: true });
}