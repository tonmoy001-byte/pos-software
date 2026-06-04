import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (store.status !== "suspended") {
    return NextResponse.json({ error: "Store is not suspended" }, { status: 400 });
  }

  const updated = await prisma.store.update({
    where: { id },
    data: {
      status: "active",
      suspendedAt: null,
      suspendedBy: null,
      suspendedReason: null,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  return NextResponse.json({ store: updated });
}
