export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "product:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    
    // Security: Verify product belongs to user's store before delete
    const product = await prisma.product.findFirst({
      where: { id, storeId: session.user.storeId }
    });
    
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    
    // Soft delete: Update deletedAt instead of hard delete
    // This preserves sales history and audit trail
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await eventStore.append({
      aggregateType: "Product",
      aggregateId: id,
      type: "DELETED",
      payload: {
        name: product.name,
        barcode: product.barcode,
      },
      userId: session.user.id,
      storeId: session.user.storeId,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Failed to delete product", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}