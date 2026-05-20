export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const supplierService = new SupplierService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "supplier:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supplier = await supplierService.findById(id, session.user.storeId);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    return NextResponse.json(supplier);
  } catch (error: any) {
    logger.error("Supplier fetch error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "supplier:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const data = await req.json();
    const supplier = await supplierService.update(
      id,
      data,
      session.user.id,
      session.user.storeId
    );
    return NextResponse.json(supplier);
  } catch (error: any) {
    logger.error("Supplier update error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, "supplier:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await supplierService.delete(id, session.user.storeId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Supplier delete error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}