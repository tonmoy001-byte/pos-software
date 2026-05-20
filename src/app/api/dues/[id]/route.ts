export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const sale = await saleService.findById(id);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    
    // Security: Validate storeId matches session
    if (sale.storeId !== session.user.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    return NextResponse.json(sale);
  } catch (error: any) {
    logger.error("Sale fetch error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "sale:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  try {
    const rawAmount = data.amount;

    // ── Guard: amount must be a real positive number ──────────────────────
    const amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount is required and must be a positive number." },
        { status: 400 }
      );
    }

    // Security: Validate storeId matches session before payment
    const sale = await saleService.findById(id);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    if (sale.storeId !== session.user.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (amount > Number(sale.dueAmount)) {
      return NextResponse.json(
        { error: `Amount exceeds due. Max: ${Number(sale.dueAmount).toFixed(2)}` },
        { status: 400 }
      );
    }

    const result = await saleService.collectPayment(
      id,
      amount,
      data.method || "CASH",
      session.user.id,
      session.user.storeId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error("Payment collection error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    const isClientError = error.message?.includes("not found") || error.message?.includes("exceeds") || error.message?.includes("required");
    return NextResponse.json(
      { error: isClientError ? (error instanceof Error ? error.message : "Failed to collect payment") : "Failed to collect payment" },
      { status: isClientError ? 400 : 500 }
    );
  }
}