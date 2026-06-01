import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { name, displayName, maxProducts, maxUsers, maxBranches, features } = body;

  if (!name || !displayName) {
    return NextResponse.json({ error: "Name and display name are required" }, { status: 400 });
  }

  const plan = await prisma.plan.create({
    data: {
      name,
      displayName,
      maxProducts: maxProducts || 100,
      maxUsers: maxUsers || 3,
      maxBranches: maxBranches || 1,
      features: JSON.stringify(features || []),
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}