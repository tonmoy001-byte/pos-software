export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission, logger } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const storeId = session.user.storeId;

    // Total active EMIs (sales with pending installments)
    const activeSales = await prisma.sale.findMany({
      where: {
        storeId,
        saleType: "EMI",
        status: { not: "PAID" },
      },
      include: {
        emiSchedules: {
          where: { status: "PENDING" },
        },
      },
    });

    const totalActive = activeSales.length;

    // Total outstanding
    const totalOutstanding = activeSales.reduce(
      (sum, sale) => sum + Number(sale.dueAmount),
      0
    );

    // Overdue count
    const now = new Date();
    let overdueCount = 0;
    for (const sale of activeSales) {
      const overdue = sale.emiSchedules.filter(
        (s) => new Date(s.dueDate) < now
      );
      overdueCount += overdue.length;
    }

    // Collected this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paymentsThisMonth = await prisma.payment.aggregate({
      where: {
        sale: { storeId, saleType: "EMI" },
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const collectedThisMonth = Number(paymentsThisMonth._sum.amount || 0);

    return NextResponse.json({
      totalActive,
      totalOutstanding,
      overdueCount,
      collectedThisMonth,
    });
  } catch (error) {
    logger.error("Failed to fetch EMI summary", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Failed to fetch EMI summary" },
      { status: 500 }
    );
  }
}
