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

    const sale = await prisma.sale.findUnique({
      where: { id: saleId }
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const newTotalPaid = Number(sale.paidAmount) + Number(paidAmount);
    const remainingDue = Number(sale.totalAmount) - newTotalPaid;

    const status = remainingDue <= 0 ? "PAID" : "PARTIAL";

    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: newTotalPaid,
        dueAmount: Math.max(0, remainingDue),
        status,
        deliveryDate: new Date()
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (method) {
      await prisma.payment.create({
        data: {
          saleId: sale.id,
          amount: Number(paidAmount),
          method,
          storeId: session.user.storeId
        }
      });
    }

    return NextResponse.json(updatedSale);
  } catch (error) {
    console.error("Failed to complete advance order:", error);
    return NextResponse.json({ error: "Failed to complete advance order" }, { status: 500 });
  }
}