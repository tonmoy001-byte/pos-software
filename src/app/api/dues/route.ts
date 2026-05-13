export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService } from "@/lib/services";

const saleService = new SaleService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  } catch (error) {
    console.error("Dues fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}