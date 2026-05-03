export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const storeId = session.user.storeId;
    
    const advances = await prisma.sale.findMany({
      where: {
        storeId,
        saleType: "ADVANCE_ORDER"
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const formatted = advances.map((sale: any) => ({
      id: sale.id,
      invoiceId: sale.invoiceId,
      customerName: sale.customer?.name || "Walking Customer",
      customerPhone: sale.customer?.phone || null,
      items: sale.items.map((item: any) => ({
        name: item.product?.name || "Unknown",
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      status: sale.status,
      createdAt: sale.createdAt?.toISOString()
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch advances:", error);
    return NextResponse.json({ error: "Failed to fetch advances" }, { status: 500 });
  }
}