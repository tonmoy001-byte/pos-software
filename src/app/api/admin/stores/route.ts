import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/services/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.id || !isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { users: { some: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      include: {
        subscription: { include: { plan: true } },
        users: { select: { id: true, name: true, username: true, role: true } },
        _count: { select: { products: true, sales: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.store.count({ where }),
  ]);

  return NextResponse.json({
    stores,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}