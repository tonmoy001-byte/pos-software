export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const supplierService = new SupplierService();

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "supplier:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { linkId } = await params;
    await supplierService.removeProduct(linkId, session.user.storeId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Supplier product remove error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to remove product" }, { status: 500 });
  }
}