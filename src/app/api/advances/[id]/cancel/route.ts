export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger, eventStore, recordStockMovement } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import type { Role } from "@prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "sale:cancel")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session?.user?.storeId) {
    const writeCheck = await canWrite(session.user.storeId, session.user.id);
    if (!writeCheck.allowed) {
      return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
    }
  }

  try {
    const { id: saleId } = await params;
    const userId = session.user.id;
    const storeId = session.user.storeId;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId, storeId },
      include: { items: { include: { product: true } }, payments: true }
    });

    if (!sale) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (sale.saleType !== "ADVANCE_ORDER") {
      return NextResponse.json({ error: "Not an advance order" }, { status: 400 });
    }

    if (sale.status === "COMPLETED" || sale.status === "CANCELLED") {
      return NextResponse.json({ error: `Cannot cancel - order is already ${sale.status.toLowerCase()}` }, { status: 400 });
    }

    const paidAmount = Number(sale.paidAmount);
    const totalAmount = Number(sale.totalAmount);

    await prisma.$transaction(async (tx) => {
      // Restore stock for advance order items (stock was reserved, not deducted)
      for (const item of sale.items) {
        const currentStock = Number((await tx.product.findUnique({ where: { id: item.productId } }))?.stock || 0);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
        await recordStockMovement(item.productId, item.quantity, "CANCELLED", storeId, {
          referenceId: saleId,
          referenceType: "Sale",
          tx,
          stockBefore: currentStock,
        });
      }

      // Mark payments as refunded
      if (sale.payments.length > 0) {
        await tx.payment.updateMany({
          where: { saleId, status: "ACTIVE" },
          data: { status: "REFUNDED" },
        });
      }

      // Refund transaction if customer had paid
      if (paidAmount > 0) {
        await tx.transaction.create({
          data: {
            type: "SALE_REFUND",
            amount: paidAmount,
            mode: (sale.payments.length > 0 ? sale.payments[0].method : "CASH") as "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE",
            description: `Cancelled advance order: ${sale.invoiceId}`,
            referenceId: saleId,
            referenceType: "SALE",
            userId,
            storeId,
          },
        });
      }

      // Adjust customer due if linked
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

      // Cancel the order
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: "CANCELLED",
          paidAmount: 0,
          dueAmount: 0,
        },
      });

      // Audit event
      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "ORDER_CANCELLED",
        payload: {
          invoiceId: sale.invoiceId,
          paidAmount,
          totalAmount,
          customerId: sale.customerId,
          itemsCount: sale.items.length,
        },
        userId,
        storeId,
      } as any, tx);
    });

    const updatedSale = await prisma.sale.findUnique({
      where: { id: saleId, storeId },
      include: { customer: true, items: { include: { product: true } } }
    });

    return NextResponse.json(updatedSale);
  } catch (error: any) {
    logger.error("Failed to cancel advance order", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to cancel advance order" }, { status: 500 });
  }
}
