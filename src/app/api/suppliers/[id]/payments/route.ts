export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierPaymentService, hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { z } from "zod";
import type { Role } from "@prisma/client";

const supplierPaymentService = new SupplierPaymentService();

const paymentCreateSchema = z.object({
  purchaseId: z.string().uuid().nullable().optional(),
  amount: z.number().positive("Amount must be positive"),
  mode: z.string().min(1, "Payment mode is required"),
  notes: z.string().optional(),
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
    const payments = await supplierPaymentService.findBySupplier(id, session.user.storeId);
    return NextResponse.json(payments);
  } catch (error: any) {
    logger.error("Supplier payments fetch error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
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
    const result = paymentCreateSchema.safeParse(json);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({
        error: firstError?.message || "Validation failed",
        details: result.error.format(),
      }, { status: 400 });
    }

    const payment = await supplierPaymentService.create(
      id,
      { ...result.data, purchaseId: result.data.purchaseId || undefined },
      session.user.storeId,
      session.user.id
    );

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    logger.error("Supplier payment creation error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to create payment" }, { status: 500 });
  }
}
