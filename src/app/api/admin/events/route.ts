export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventStore, hasPermission } from "@/lib/services";
import type { Role } from "@prisma/client";

const eventStore = new EventStore();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "report:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const aggregateType = url.searchParams.get("type") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const skip = (page - 1) * limit;

  const where: any = { storeId: session.user.storeId };
  if (aggregateType) where.aggregateType = aggregateType;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.event.count({ where }),
  ]);

  const parsed = events.map(e => ({
    ...e,
    payload: typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload,
    metadata: e.metadata ? (typeof e.metadata === "string" ? JSON.parse(e.metadata) : e.metadata) : null,
  }));

  return NextResponse.json({ events: parsed, total, page, totalPages: Math.ceil(total / limit) });
}
