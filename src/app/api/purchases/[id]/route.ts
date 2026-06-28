export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PurchaseService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const purchaseService = new PurchaseService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "supplier:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const purchase = await purchaseService.findById(id, session.user.storeId);
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    return NextResponse.json(purchase);
  } catch (error: any) {
    logger.error("Purchase fetch error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch purchase" }, { status: 500 });
  }
}
