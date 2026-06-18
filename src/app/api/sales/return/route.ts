import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, logger, recordStockMovement, eventStore, postRefundEntry } from "@/lib/services";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

/**
 * POST /api/sales/return
 *
 * Processes a PARTIAL sale return:
 *   body: {
 *     saleId:       string,
 *     items:        [{ saleItemId: string, returnQty: number }],
 *     refundAmount: number,      // total refund value
 *     refundMethod: string,      // how the refund is issued back to customer
 *   }
 *
 * Behaviour
 *   • Re-opens stock only for the QTY actually being returned
 *     (not the full original quantity).
 *   • Creates a partial REFUND entry if there is still remaining
 *     stock after the return — a full-return refund is created only
 *     when ALL items are returned and the schedule opens correctly.
 *   • Adjusts the sale totals so the due / paid / status fields
 *     are always consistent.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "sale:refund")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { saleId, items, refundAmount, refundMethod, returnReason } = body;
  if (!saleId)          return NextResponse.json({ error: "saleId is required." },     { status: 400 });
  if (!items?.length)   return NextResponse.json({ error: "At least one return item is required." }, { status: 400 });
  if (refundAmount == null || refundAmount <= 0)
    return NextResponse.json({ error: "refundAmount must be a positive number." }, { status: 400 });

  try {
    const userId       = session.user.id;
    const storeId      = session.user.storeId;
    const method       = refundMethod || "CASH";

    const result = await prisma.$transaction(async (tx) => {
      // ── 1. Lock the sale ────────────────────────────────────────────────
      const sale = await tx.sale.findFirst({
        where: { id: saleId, storeId },
        include: { items: { include: { product: true } } },
      });
      if (!sale) throw new Error("Sale not found.");

      const totalReturnQty  = items.reduce((sum: number, i: any) => sum + (i.returnQty || 0), 0);
      const totalItems      = sale.items.length;
      const allItemsReturned = items.every((i: any) => {
        const si       = sale.items.find((s: any) => s.id === i.saleItemId);
        const origQty  = si?.quantity ?? 0;
        const alreadyReturned = si?.returnedQuantity ?? 0;
        const retQty   = i.returnQty ?? 0;
        return (alreadyReturned + retQty) >= origQty;
      });
      const isFullReturn = allItemsReturned;

      // ── 2. Re-open stock for returned units only ───────────────────────
      for (const retItem of items) {
        const saleItem = sale.items.find((si: any) => si.id === retItem.saleItemId);
        if (!saleItem) continue;

        const alreadyReturned = saleItem.returnedQuantity ?? 0;
        const availableToReturn = saleItem.quantity - alreadyReturned;
        const qtyToReturn = Math.min(retItem.returnQty, availableToReturn);
        if (qtyToReturn <= 0) continue;

        await tx.product.update({
          where: { id: saleItem.productId },
          data: { stock: { increment: qtyToReturn } },
        });
        await recordStockMovement(
          saleItem.productId, qtyToReturn, "REFUND", storeId,
          { referenceId: sale.id, referenceType: "Sale", tx }
        );
        await tx.saleItem.update({
          where: { id: saleItem.id },
          data: { 
            returnedQuantity: { increment: qtyToReturn },
            ...(returnReason && { returnReason })
          },
        });
      }

      // ── 3. Update sale totals ───────────────────────────────────────────
      const originalTotal = Number(sale.totalAmount);
      const originalPaid  = Number(sale.paidAmount);
      const originalDue   = Number(sale.dueAmount);
      const newTotal      = originalTotal - refundAmount;
      // Refund reduces paid first, then due
      const refundFromPaid = Math.min(refundAmount, originalPaid);
      const refundFromDue  = refundAmount - refundFromPaid;
      const newDue   = Math.max(0, originalDue - refundFromDue);
      const newPaid  = Math.max(0, originalPaid - refundFromPaid);
      const newStatus = (isFullReturn && newDue === 0) ? "CANCELLED" :
                         newDue <= 0 ? "PAID" :
                         newPaid > 0  ? "PARTIAL" : "DUE";

      await tx.sale.update({
        where: { id: saleId },
        data: {
          totalAmount:    newTotal,
          refundedAmount: { increment: refundAmount },
          dueAmount:      newDue,
          paidAmount:     newPaid,
          status:         newStatus as any,
        },
      });

      // ── 4. Adjust customer due ──────────────────────────────────────────
      if (sale.customerId) {
        const remaining = await tx.sale.aggregate({
          where: { customerId: sale.customerId, id: { not: saleId }, dueAmount: { gt: 0 } },
          _sum: { dueAmount: true },
        });
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { dueAmount: Number(remaining._sum.dueAmount || 0) },
        });
      }

      // ── 5. Audit event ─────────────────────────────────────────────────
      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "REFUND_PROCESSED",
        payload: {
          refundAmount,
          refundMethod:    method,
          itemsReturned:   items.map((i: any) => ({ saleItemId: i.saleItemId, returnQty: i.returnQty })),
          isFullReturn,
          remainingDue:    newDue,
        },
        userId,
        storeId,
      } as any, tx);

      // ── 6. Refund transaction ───────────────────────────────────────────
      await tx.transaction.create({
        data: {
          type: "SALE_REFUND",
          amount: refundAmount,
          mode: method,
          description: `Return: ${sale.invoiceId}`,
          referenceId: saleId,
          referenceType: "SALE",
          userId,
          storeId,
        },
      });

      // ── 7. Journal entry for refund ─────────────────────────────────────
      const totalCost = sale.items.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0) * item.quantity, 0);
      await postRefundEntry(saleId, refundAmount, totalCost, method, isFullReturn, storeId, tx);

      return { success: true, newDue, newPaid, newStatus };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    logger.error("Return processing failed", { storeId: session.user.storeId, error: err.message });
    return NextResponse.json({ error: err.message || "Failed to process return." }, { status: 500 });
  }
}
