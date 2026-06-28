export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierReturnService, hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { z } from "zod";
import type { Role } from "@prisma/client";

const supplierReturnService = new SupplierReturnService();

const returnCreateSchema = z.object({
  purchaseId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitCost: z.number().nonnegative("Unit cost must be non-negative"),
  reason: z.string().optional(),
});

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
    const returns = await supplierReturnService.findBySupplier(id, session.user.storeId);
    return NextResponse.json(returns);
  } catch (error: any) {
    logger.error("Supplier returns fetch error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch returns" }, { status: 500 });
  }
}

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
    const json = await req.json();
    const result = returnCreateSchema.safeParse(json);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({
        error: firstError?.message || "Validation failed",
        details: result.error.format(),
      }, { status: 400 });
    }

    const returnRecord = await supplierReturnService.create(
      id,
      { ...result.data, purchaseId: result.data.purchaseId || undefined, productId: result.data.productId || undefined },
      session.user.storeId,
      session.user.id
    );

    return NextResponse.json(returnRecord, { status: 201 });
  } catch (error: any) {
    logger.error("Supplier return creation error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to create return" }, { status: 500 });
  }
}
