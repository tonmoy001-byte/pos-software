export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  } catch (error: any) {
    logger.error("Failed to fetch advances", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch advances" }, { status: 500 });
  }
}