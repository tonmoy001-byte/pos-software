export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PurchaseService, hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { z } from "zod";
import type { Role } from "@prisma/client";

const purchaseService = new PurchaseService();

const purchaseItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  sellCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const purchaseCreateSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier ID"),
  items: z.array(purchaseItemSchema).min(1, "At least one item required"),
  notes: z.string().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "supplier:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");

    const purchases = await purchaseService.findAll(session.user.storeId, {
      status: status || undefined,
      supplierId: supplierId || undefined,
    });

    return NextResponse.json(purchases);
  } catch (error: any) {
    logger.error("Purchases fetch error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    const json = await req.json();
    const result = purchaseCreateSchema.safeParse(json);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({
        error: firstError?.message || "Validation failed",
        details: result.error.format(),
      }, { status: 400 });
    }

    const purchase = await purchaseService.create(
      result.data,
      session.user.storeId,
      session.user.id
    );

    return NextResponse.json(purchase, { status: 201 });
  } catch (error: any) {
    logger.error("Purchase creation error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to create purchase" }, { status: 500 });
  }
}
