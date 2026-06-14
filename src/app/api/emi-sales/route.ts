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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const where: any = {
      storeId: session.user.storeId,
      saleType: "EMI",
    };

    if (search) {
      where.OR = [
        { invoiceId: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        emiSchedules: {
          orderBy: { installmentNo: "asc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with computed fields
    const enrichedSales = sales.map((sale) => {
      const schedules = sale.emiSchedules;
      const pendingInstallments = schedules.filter((s) => s.status === "PENDING");
      const overdueInstallments = pendingInstallments.filter(
        (s) => new Date(s.dueDate) < new Date()
      );
      const nextDue = pendingInstallments.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )[0];

      let computedStatus = "ACTIVE";
      if (sale.status === "PAID") {
        computedStatus = "COMPLETED";
      } else if (overdueInstallments.length > 0) {
        computedStatus = "OVERDUE";
      }

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceId,
        customer: sale.customer,
        date: sale.createdAt,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
        emiMonths: sale.emiMonths,
        monthlyAmount: sale.monthlyAmount,
        status: computedStatus,
        nextDue: nextDue?.dueDate || null,
        nextDueAmount: nextDue?.amount || null,
        pendingCount: pendingInstallments.length,
        overdueCount: overdueInstallments.length,
      };
    });

    // Filter by computed status
    let filtered = enrichedSales;
    if (status) {
      filtered = enrichedSales.filter((s) => s.status === status.toUpperCase());
    }

    return NextResponse.json({ sales: filtered });
  } catch (error) {
    logger.error("Failed to fetch EMI sales", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Failed to fetch EMI sales" },
      { status: 500 }
    );
  }
}
