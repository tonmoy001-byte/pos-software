export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, eventStore, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "product:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { action, productIds, value } = data;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: "No products selected" }, { status: 400 });
  }

  try {
    let affected = 0;

    switch (action) {
      case "delete": {
        const result = await prisma.product.deleteMany({
          where: { id: { in: productIds }, storeId: session.user.storeId },
        });
        affected = result.count;
        break;
      }
      case "updateCategory": {
        if (!value) return NextResponse.json({ error: "Category value required" }, { status: 400 });
        const result = await prisma.product.updateMany({
          where: { id: { in: productIds }, storeId: session.user.storeId },
          data: { category: value.toUpperCase() },
        });
        affected = result.count;
        break;
      }
      case "updateStatus": {
        if (!value) return NextResponse.json({ error: "Status value required" }, { status: 400 });
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, storeId: session.user.storeId },
        });
        for (const product of products) {
          const metadata = (product.metadata as Record<string, any>) || {};
          await prisma.product.update({
            where: { id: product.id },
            data: { metadata: { ...metadata, status: value } },
          });
        }
        affected = products.length;
        break;
      }
      case "updatePrice": {
        if (value === undefined || value === null) return NextResponse.json({ error: "Price value required" }, { status: 400 });
        const result = await prisma.product.updateMany({
          where: { id: { in: productIds }, storeId: session.user.storeId },
          data: { price: parseFloat(value) },
        });
        affected = result.count;
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await eventStore.append({
      aggregateType: "Product",
      aggregateId: "bulk",
      type: "UPDATED",
      payload: { action, productIds, value, affected },
      userId: session.user.id,
      storeId: session.user.storeId,
    });

    return NextResponse.json({ success: true, affected });
  } catch (error: any) {
    logger.error("Bulk product operation failed", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 });
  }
}
