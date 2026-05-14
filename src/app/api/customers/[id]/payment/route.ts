export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { eventStore, EventStoreData } from "@/lib/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { amount, method, note } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id, storeId: session.user.storeId }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const paymentAmount = Math.min(amount, Number(customer.dueAmount || 0));

    if (Number(customer.dueAmount) <= 0) {
      return NextResponse.json({ error: "No due to pay" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find all due sales for this customer (oldest first)
      const dueSales = await tx.sale.findMany({
        where: { customerId: id, dueAmount: { gt: 0 } },
        orderBy: { createdAt: "asc" },
      });

      if (dueSales.length === 0) {
        throw new Error("No due sales found for this customer");
      }

      // 2. Distribute payment across sales (FIFO)
      let remaining = paymentAmount;
      const appliedPayments: { saleId: string; amount: number; invoiceId: string }[] = [];

      for (const sale of dueSales) {
        if (remaining <= 0) break;
        const saleDue = Number(sale.dueAmount);
        const payAmount = Math.min(remaining, saleDue);
        const newDue = saleDue - payAmount;

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: { increment: payAmount },
            dueAmount: { decrement: payAmount },
            status: newDue <= 0 ? "PAID" : "PARTIAL",
          },
        });

        remaining -= payAmount;
        appliedPayments.push({
          saleId: sale.id,
          amount: payAmount,
          invoiceId: sale.invoiceId,
        });
      }

      // 3. Recalculate customer due from remaining sale dues
      const remainingDues = await tx.sale.aggregate({
        where: { customerId: id, dueAmount: { gt: 0 } },
        _sum: { dueAmount: true },
      });

      await tx.customer.update({
        where: { id },
        data: { dueAmount: Number(remainingDues._sum.dueAmount || 0) },
      });

      // 4. Create Payment record (link to first sale for reference)
      await tx.payment.create({
        data: {
          amount: paymentAmount,
          method,
          customerId: id,
          storeId: session.user.storeId,
        },
      });

      // 5. Create transaction
      const invoiceRefs = appliedPayments.map(p => p.invoiceId).join(", ");
      await tx.transaction.create({
        data: {
          type: "DUE_PAYMENT",
          amount: paymentAmount,
          mode: method,
          description: note || `Payment from ${customer.name} — ${invoiceRefs}`,
          customerId: id,
          userId: session.user.id,
          storeId: session.user.storeId,
        },
      });

      // 6. Append event
      await eventStore.append({
        aggregateType: "Customer",
        aggregateId: id,
        type: "PAYMENT_RECEIVED",
        payload: {
          amount: paymentAmount,
          method,
          previousDue: Number(customer.dueAmount),
          newDue: Number(remainingDues._sum.dueAmount || 0),
          appliedTo: appliedPayments.map(p => ({
            invoiceId: p.invoiceId,
            amount: p.amount,
          })),
        },
        userId: session.user.id,
        storeId: session.user.storeId,
      } as EventStoreData);

      return {
        success: true,
        amount: paymentAmount,
        appliedPayments,
        remainingDue: Number(remainingDues._sum.dueAmount || 0),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment failed" },
      { status: 500 }
    );
  }
}
