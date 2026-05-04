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
        },
        payments: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const formatted = advances.map((sale: any) => ({
      id: sale.id,
      invoiceId: sale.invoiceId,
      customerName: sale.customerName || sale.customer?.name || "Walking Customer",
      customerPhone: sale.customer?.phone || null,
      customerAddress: sale.customer?.address || null,
      items: sale.items.map((item: any) => ({
        name: item.product?.name || "Unknown",
        model: item.product?.model || "",
        brand: item.product?.brand || "",
        quantity: item.quantity,
        price: Number(item.price)
      })),
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      discount: Number(sale.discount) || 0,
      paymentMethod: sale.payments?.[0]?.method || "CASH",
      deliveryDate: sale.deliveryDate ? sale.deliveryDate.toISOString() : null,
      status: sale.status,
      createdAt: sale.createdAt?.toISOString()
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch advances:", error);
    return NextResponse.json({ error: "Failed to fetch advances" }, { status: 500 });
  }
}