export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "ALL";
  const statsOnly = searchParams.get("stats") === "true";

  try {
    if (statsOnly) {
      const stats = await saleService.getDueSalesStats(session.user.storeId);
      return NextResponse.json(stats);
    }

    const result = await saleService.getDueSales(session.user.storeId, { page, limit, search, status });
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error("Dues fetch error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}