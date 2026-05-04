export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: saleId } = await params;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId }
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

    // Cancel the order
    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: { status: "CANCELLED" },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    return NextResponse.json(updatedSale);
  } catch (error: any) {
    console.error("Failed to cancel advance order:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel advance order" }, { status: 500 });
  }
}