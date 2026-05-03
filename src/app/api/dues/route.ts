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

  try {
    const dues = await saleService.getDueSales(session.user.storeId);
    return NextResponse.json(dues);
  } catch (error) {
    console.error("Dues fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}