export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PurchaseService, hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import type { Role } from "@prisma/client";

const purchaseService = new PurchaseService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "supplier:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const writeCheck = await canWrite(session.user.storeId, session.user.id);
  if (!writeCheck.allowed) {
    return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
  }

  try {
    const { id } = await params;
    const purchase = await purchaseService.submit(id, session.user.storeId);
    return NextResponse.json(purchase);
  } catch (error: any) {
    logger.error("Purchase submit error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to submit purchase" }, { status: 500 });
  }
}
