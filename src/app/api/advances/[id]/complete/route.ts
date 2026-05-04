export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: saleId } = await params;
    const { paidAmount, method } = await req.json();

    // Fetch the advance order
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (sale.saleType !== "ADVANCE_ORDER") {
      return NextResponse.json({ error: "Not an advance order" }, { status: 400 });
    }

    if (sale.status === "COMPLETED" || sale.status === "CANCELLED") {
      return NextResponse.json({ error: `Cannot complete - order is ${sale.status.toLowerCase()}` }, { status: 400 });
    }

    // Calculate remaining amount to complete
    const remainingAmount = Number(sale.totalAmount) - Number(sale.paidAmount);
    const paymentAmount = paidAmount ? Number(paidAmount) : remainingAmount;

    // Process in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create payment record
      await tx.payment.create({
        data: {
          amount: paymentAmount,
          method: method || "CASH",
          saleId: sale.id,
          storeId: session.user.storeId,
        }
      });

      // 2. Note: Stock is not automatically deducted for advance orders
      // Stock should be managed via SerializedItem (IMEI) tracking separately

      // 3. Update sale to completed
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: { increment: paymentAmount },
          dueAmount: 0,
          status: "COMPLETED"
        },
        include: {
          customer: true,
          items: { include: { product: true } }
        }
      });

      return updatedSale;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to complete advance order:", error);
    return NextResponse.json({ error: error.message || "Failed to complete advance order" }, { status: 500 });
  }
}