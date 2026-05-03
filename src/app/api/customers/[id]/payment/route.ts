export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

    const currentDue = Number(customer.dueAmount) || 0;
    const paymentAmount = Math.min(amount, currentDue);

    if (currentDue <= 0) {
      return NextResponse.json({ error: "No due to pay" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          dueAmount: Math.max(0, currentDue - paymentAmount)
        }
      });

      await tx.payment.create({
        data: {
          amount: paymentAmount,
          method,
          saleId: id,
          storeId: session.user.storeId
        }
      });

      await tx.transaction.create({
        data: {
          type: "DUE_PAYMENT",
          amount: paymentAmount,
          mode: method,
          description: note || `Payment from ${customer.name}`,
          customerId: id,
          userId: session.user.id,
          storeId: session.user.storeId
        }
      });
    });

    return NextResponse.json({ success: true, amount: paymentAmount });
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}