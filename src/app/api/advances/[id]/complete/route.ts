export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SaleService } from "@/lib/services/sale";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: saleId } = await params;
    const { paidAmount, method } = await req.json();

    const saleService = new SaleService();

    // collect payment handles the transaction, payment record, and customer due logic
    await saleService.collectPayment(saleId, Number(paidAmount), method || "CASH", session.user.id, session.user.storeId);

    // update delivery date for advance order
    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: { deliveryDate: new Date() },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    return NextResponse.json(updatedSale);
  } catch (error: any) {
    console.error("Failed to complete advance order:", error);
    return NextResponse.json({ error: error.message || "Failed to complete advance order" }, { status: 500 });
  }
}