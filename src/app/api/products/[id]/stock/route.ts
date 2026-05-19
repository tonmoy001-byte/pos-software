export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, recordStockMovement, eventStore, EventStoreData, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "product:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const quantity = data.quantity ? parseInt(data.quantity) : 1;

  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "Valid quantity required" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id, storeId: session.user.storeId }
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { stock: { increment: quantity } }
      });

      await recordStockMovement(id, quantity, "STOCK_IN", session.user.storeId, {
        referenceType: "StockIn",
        tx,
        stockBefore: Number(product.stock),
      });

      await eventStore.append({
        aggregateType: "Product",
        aggregateId: id,
        type: "UPDATED",
        payload: { stockChange: quantity, reason: "STOCK_IN" },
        userId: session.user.id,
        storeId: session.user.storeId,
      }, tx);
    });

    return NextResponse.json({ success: true, quantity });
  } catch (error: any) {
    logger.error("Failed to add stock", { productId: id, storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "product:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const stock = data.stock !== undefined ? parseInt(data.stock) : null;

  if (stock === null) {
    return NextResponse.json({ error: "Stock value required" }, { status: 400 });
  }

  try {
    const current = await prisma.product.findUnique({ where: { id, storeId: session.user.storeId }, select: { stock: true } });
    if (!current) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (stock < 0) return NextResponse.json({ error: "Stock cannot be negative" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { stock }
      });

      const quantityChange = stock - current.stock;
      await recordStockMovement(id, quantityChange, "STOCK_ADJUSTMENT", session.user.storeId, {
        referenceType: "StockOverride",
        tx,
      });

      await eventStore.append({
        aggregateType: "Product",
        aggregateId: id,
        type: "UPDATED",
        payload: { stockOverride: stock, previousStock: current.stock },
        userId: session.user.id,
        storeId: session.user.storeId,
      }, tx);
    });

    return NextResponse.json({ success: true, stock });
  } catch (error: any) {
    logger.error("Failed to update stock", { productId: id, storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}