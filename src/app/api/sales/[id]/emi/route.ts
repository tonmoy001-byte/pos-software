import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

/**
 * POST /api/sales/[id]/emi
 *
 * Collect one or more EMI instalments against an EMI sale, moving it
 * from DUE → PARTIAL → PAID exactly like collectPayment but scoped
 * to EMI sale type and returning the next expected instalment amount.
 *
 * body: { amount?: number, method?: "CASH"|"BKASH"|"NAGAD"|"CARD"|"BANK" }
 *         amount  — if omitted, the entire remaining due is collected at once
 *         method  — payment method (default: CASH)
 */
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

  const { id: saleId } = await params;

  try {
    const body = await req.json();
    const rawAmount = body.amount ?? null;   // null → collect everything
    const method    = body.method || "CASH";

    const amount = rawAmount != null ? parseFloat(String(rawAmount)) : null;

    // ── Fetch the sale before touching the transaction ─────────────────────
    const sale = await saleService.findById(saleId);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    if (sale.storeId !== session.user.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // ── EMI sales only ─────────────────────────────────────────────────────
    if (sale.saleType !== "EMI") {
      return NextResponse.json(
        { error: `This sale is type "${sale.saleType}", not EMI. Use the regular payment endpoint.` },
        { status: 400 }
      );
    }

    if (!sale.dueAmount || Number(sale.dueAmount) <= 0) {
      return NextResponse.json(
        { error: "This EMI sale is already fully paid." },
        { status: 400 }
      );
    }

    // ── Determine how much to collect ──────────────────────────────────────
    const currentDue   = Number(sale.dueAmount);
    const collectNow  = amount != null ? amount : currentDue;  // null → everything

    if (!isFinite(collectNow) || collectNow <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Enter a positive number." },
        { status: 400 }
      );
    }

    if (collectNow > currentDue) {
      return NextResponse.json(
        { error: `Amount exceeds remaining due. Max: ${currentDue.toFixed(2)}` },
        { status: 400 }
      );
    }

    // ── Process ────────────────────────────────────────────────────────────
    const result = await saleService.collectPayment(
      saleId,
      collectNow,
      method,
      session.user.id,
      session.user.storeId
    );

    // Re-read the sale for the next instalment hint
    const updatedSale = await saleService.findById(saleId);

    return NextResponse.json({
      ...result,
      collectedThisTime: collectNow,
      remainingDue:   Number(updatedSale!.dueAmount),
      status:         updatedSale!.status,  // DUE / PARTIAL / PAID
      isEmiPaidOff:   Number(updatedSale!.dueAmount) <= 0,
    });
  } catch (err: any) {
    logger.error("EMI collection failed", {
      storeId: session.user.storeId,
      saleId,
      error: err.message,
    });
    return NextResponse.json(
      { error: err.message || "Failed to collect EMI payment." },
      { status: 400 }
    );
  }
}
