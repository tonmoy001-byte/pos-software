export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, eventStore, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id, storeId: session.user.storeId },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (error: any) {
    logger.error("Failed to fetch product", { productId: id, storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PATCH(
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

  const dbFields = ["name", "price", "cost", "minStock", "category", "brand"];
  const metaFields = ["status"];
  const dbUpdates: Record<string, any> = {};
  const metaUpdates: Record<string, any> = {};

  for (const field of dbFields) {
    if (data[field] !== undefined) dbUpdates[field] = data[field];
  }
  for (const field of metaFields) {
    if (data[field] !== undefined) metaUpdates[field] = data[field];
  }

  if (Object.keys(dbUpdates).length === 0 && Object.keys(metaUpdates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (dbUpdates.price !== undefined && dbUpdates.cost !== undefined) {
    if (dbUpdates.cost > 0 && dbUpdates.price < dbUpdates.cost) {
      return NextResponse.json({ error: "Selling price must be >= cost price" }, { status: 400 });
    }
  }

  try {
    const existing = await prisma.product.findUnique({ where: { id, storeId: session.user.storeId } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (dbUpdates.price !== undefined || dbUpdates.cost !== undefined) {
      const newPrice = dbUpdates.price ?? Number(existing.price);
      const newCost = dbUpdates.cost ?? Number(existing.cost);
      dbUpdates.profit = newPrice - newCost;
    }

    const metadata = (existing.metadata as Record<string, any>) || {};
    if (Object.keys(metaUpdates).length > 0) {
      dbUpdates.metadata = { ...metadata, ...metaUpdates };
    }

    const product = await prisma.product.update({ where: { id }, data: dbUpdates });

    await eventStore.append({
      aggregateType: "Product",
      aggregateId: id,
      type: "UPDATED",
      payload: { fields: [...Object.keys(dbUpdates), ...Object.keys(metaUpdates)], previous: existing },
      userId: session.user.id,
      storeId: session.user.storeId,
    });

    return NextResponse.json(product);
  } catch (error: any) {
    logger.error("Failed to update product", { productId: id, storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "product:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({ where: { id, storeId: session.user.storeId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });

    await eventStore.append({
      aggregateType: "Product",
      aggregateId: id,
      type: "DELETED",
      payload: { name: product.name, brand: product.brand },
      userId: session.user.id,
      storeId: session.user.storeId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Failed to delete product", { productId: id, storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
