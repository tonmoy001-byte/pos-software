import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { eventStore, EventStoreData, recordStockMovement } from "@/lib/services";

/**
 * POST /api/advances/[id]/complete
 *
 * Records an advance payment against an ADVANCE_ORDER sale.
 * Called when the customer arrives to collect their pre-ordered device(s).
 *
 * Body: { paidAmount: number, method?: "CASH"|"BKASH"|"NAGAD"|"CARD"|"BANK" }
 *
 * Status transitions:
 *   PENDING  → PARTIAL   (partial initial payment on creation, kept below)
 *   PARTIAL  → COMPLETED (customer pays the full remaining balance)
 *   PARTIAL  → PARTIAL  (customer pays only part of the remaining balance)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: saleId } = await params;
  const storeId = session.user.storeId;
  const userId  = session.user.id;

  // ── 1. Fetch and authorize ────────────────────────────────────────────────
  const sale = await prisma.sale.findUnique({
    where: { id: saleId, storeId },
    include: { items: true, customer: true },
  });
  if (!sale)          return NextResponse.json({ error: "Order not found." },              { status: 404 });
  if (sale.saleType !== "ADVANCE_ORDER")
                       return NextResponse.json({ error: "Not an advance order." },             { status: 400 });
  if (sale.status === "COMPLETED")
                       return NextResponse.json({ error: "Order already completed." },          { status: 400 });
  if (sale.status === "CANCELLED")
                       return NextResponse.json({ error: "Cancelled order cannot be completed." }, { status: 400 });

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const body  = await req.json();
  const rawPaidAmount = body.paidAmount;

  // ── Paranoid: parseFloat(null/undefined) = NaN — reject it here ───────────
  const paidAmount = parseFloat(String(rawPaidAmount));
  if (isNaN(paidAmount) || paidAmount <= 0) {
    return NextResponse.json(
      { error: "Valid paidAmount (> 0) is required." },
      { status: 400 }
    );
  }

  const totalAmount   = Number(sale.totalAmount);
  const alreadyPaid   = Number(sale.paidAmount);
  const remaining     = totalAmount - alreadyPaid;

  if (paidAmount > remaining) {
    return NextResponse.json(
      { error: `Amount (৳${paidAmount}) exceeds remaining due (৳${remaining.toFixed(2)}).` },
      { status: 400 }
    );
  }

  // ── 3. Compute new state ──────────────────────────────────────────────────
  // All values are DecimalType → JS number; no sub-paise fractions can exist
  // after the parseFloat guard above, so === 0 is a safe stop-loss.
  const newPaidTotal = alreadyPaid + paidAmount;
  const newDue       = totalAmount - newPaidTotal;
  const isFullyPaid  = newDue === 0;
  const newStatus    = isFullyPaid ? ("COMPLETED" as const) : ("PARTIAL" as const);

  // ── 3.5. Validate stock before completing ─────────────────────────────────
  if (isFullyPaid && sale.items.length > 0) {
    const productIds = sale.items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true },
    });

    const stockErrors: string[] = [];
    for (const item of sale.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        stockErrors.push(`Product not found (ID: ${item.productId})`);
      } else if (product.stock < item.quantity) {
        stockErrors.push(
          `${product.name}: current stock ${product.stock}, required ${item.quantity}`
        );
      }
    }

    if (stockErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Insufficient stock to complete this order:",
          details: stockErrors,
        },
        { status: 400 }
      );
    }
  }

  // ── 4. Persist atomically ─────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // Payment record
    await tx.payment.create({
      data: {
        saleId,
        amount: paidAmount,
        method: body.method || "CASH",
        storeId,
      },
    });

    // Update sale
    await tx.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: newPaidTotal,
        dueAmount:  Math.max(0, newDue),
        status:     newStatus,
      },
    });

    // Only DECREMENT stock on COMPLETED (advance orders carry no stock on creation)
    if (isFullyPaid) {
      const productIds = sale.items.map(item => item.productId);
      const currentProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true },
      });
      for (const item of sale.items) {
        const currentProduct = currentProducts.find(p => p.id === item.productId);
        const currentStock = currentProduct ? Number(currentProduct.stock) : 0;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        await recordStockMovement(item.productId, -item.quantity, "ADVANCE_COMPLETE", storeId, {
          referenceId:   sale.id,
          referenceType: "Sale",
          tx,
          stockBefore: currentStock,
        });
      }
    }

    // Audit event
    await eventStore.append({
      aggregateType: "Sale",
      aggregateId:   saleId,
      type:          "UPDATED",
      payload: {
        action:      "ADVANCE_PAYMENT" as const,
        paidAmount:  paidAmount,
        newStatus,
        newPaidTotal,
        newDue:      Math.max(0, newDue),
      },
      userId,
      storeId,
    } as EventStoreData, tx);
  });

  return NextResponse.json({
    success: true,
    paidThisTime:      paidAmount,
    newPaidTotal,
    newDue:            Math.max(0, newDue),
    status:            newStatus,
    customerName:      sale.customer?.name || sale.customerName || "N/A",
    isFullyPaid,
  });
}
