export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "supplier:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, storeId: session.user.storeId },
        select: { id: true, name: true, phone: true, address: true, dueAmount: true, createdAt: true },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const [purchaseStats, paymentStats, returnStats] = await Promise.all([
      prisma.purchase.aggregate({
        where: { supplierId: id, storeId: session.user.storeId, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
        _count: true,
      }),
      prisma.supplierPayment.aggregate({
        where: { supplierId: id, storeId: session.user.storeId },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.supplierReturn.aggregate({
        where: { supplierId: id, storeId: session.user.storeId },
        _sum: { totalCost: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      ...supplier,
      stats: {
        totalPurchases: purchaseStats._sum.totalAmount || 0,
        totalPaid: purchaseStats._sum.paidAmount || 0,
        totalDue: purchaseStats._sum.dueAmount || 0,
        purchaseCount: purchaseStats._count,
        totalPayments: paymentStats._sum.amount || 0,
        paymentCount: paymentStats._count,
        totalReturns: returnStats._sum.totalCost || 0,
        returnCount: returnStats._count,
      },
    });
  } catch (error: any) {
    logger.error("Supplier summary error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
