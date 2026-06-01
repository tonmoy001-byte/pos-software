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

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      users: { select: { id: true, name: true, username: true, role: true, createdAt: true } },
      _count: { select: { products: true, sales: true, customers: true } },
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  return NextResponse.json({ store });
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
  const { name, phone, email, status, description } = body;

  const store = await prisma.store.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(email && { email }),
      ...(status && { status }),
      ...(description !== undefined && { description }),
    },
  });

  return NextResponse.json({ store });
}