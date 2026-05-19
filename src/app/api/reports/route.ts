export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { hasPermission, TransactionService, CapitalService, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const transactionService = new TransactionService();
const capitalService = new CapitalService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "report:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const storeId = session.user.storeId;
  const isAdmin = session.user.role === "ADMIN";
  const storeFilter = isAdmin ? {} : { storeId };

  const range = searchParams.get("range") || "today";
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const category = searchParams.get("category");
  const saleType = searchParams.get("saleType");
  const groupBy = searchParams.get("groupBy") as "day" | "week" | "month" | undefined;

  const endDate = endParam ? endOfDay(new Date(endParam)) : new Date();
  let startDate: Date;

  if (startParam) {
    startDate = startOfDay(new Date(startParam));
  } else {
    switch (range) {
      case "week": startDate = subDays(endDate, 7); break;
      case "month": startDate = startOfMonth(endDate); break;
      case "year": startDate = subDays(endDate, 365); break;
      case "last7": startDate = startOfDay(subDays(new Date(), 6)); break;
      case "thisMonth": startDate = startOfMonth(new Date()); break;
      default: startDate = startOfDay(endDate);
    }
  }

  try {
    const whereBase: any = { ...storeFilter, createdAt: { gte: startDate, lte: endDate } };

    const [summary, capital, sales, salesByPayment, categorySales, topProducts, cashFlow] = await Promise.all([
      transactionService.getFinancialSummary(storeId, startDate, endDate, isAdmin),
      capitalService.getCapitalSummary(storeId, isAdmin),

      // Sales with optional filters
      prisma.sale.findMany({
        where: { ...whereBase, ...(saleType ? { saleType } : {}) },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { items: { include: { product: { select: { name: true, category: true } } } }, payments: true },
      }),

      // Sales grouped by payment method
      prisma.payment.groupBy({
        by: ["method"],
        where: { storeId, date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Sales aggregated by category
      prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: { ...storeFilter, createdAt: { gte: startDate, lte: endDate }, ...(saleType ? { saleType } : {}) } },
        _sum: { quantity: true, price: true, profit: true },
      }),

      // Top products
      prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: { ...storeFilter, createdAt: { gte: startDate, lte: endDate } } },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { price: "desc" } },
        take: 20,
      }),

      // Cash flow by day
      groupBy
        ? prisma.transaction.groupBy({
            by: [groupBy === "day" ? "createdAt" : groupBy === "week" ? "createdAt" : "createdAt"],
            where: { ...storeFilter, createdAt: { gte: startDate, lte: endDate } },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    // Attach product names to top products
    const productIds = [...new Set(topProducts.map(t => t.productId))];
    const productNames = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true },
    });
    const nameMap = Object.fromEntries(productNames.map(p => [p.id, p]));

    // Category aggregation
    const catMap: Record<string, { quantity: number; revenue: number; profit: number }> = {};
    for (const item of categorySales) {
      const product = productNames.find(p => p.id === item.productId);
      const cat = product?.category || "Unknown";
      if (!catMap[cat]) catMap[cat] = { quantity: 0, revenue: 0, profit: 0 };
      catMap[cat].quantity += item._sum.quantity || 0;
      catMap[cat].revenue += Number(item._sum.price || 0);
      catMap[cat].profit += Number(item._sum.profit || 0);
    }

    return NextResponse.json({
      period: { start: startDate.toISOString(), end: endDate.toISOString(), label: range },
      summary: {
        totalSales: summary.totalSales,
        salesCount: summary.transactionCount,
        cashCollected: summary.collections,
        totalDue: summary.dueSales,
        totalExpenses: summary.expenses,
        netProfit: summary.profit,
        netCash: summary.netCash,
      },
      stock: {
        productCount: capital.ownedStockValue > 0 ? await prisma.product.count({ where: storeFilter }) : 0,
        stockValue: capital.ownedStockValue,
      },
      customers: {
        total: await prisma.customer.count({ where: storeFilter }),
        totalDueOutstanding: Number((await prisma.customer.aggregate({ where: storeFilter, _sum: { dueAmount: true } }))._sum.dueAmount || 0),
      },
      sales: sales.map(s => ({
        id: s.id,
        invoiceId: s.invoiceId,
        saleType: s.saleType,
        totalAmount: Number(s.totalAmount),
        paidAmount: Number(s.paidAmount),
        dueAmount: Number(s.dueAmount),
        paymentMethod: s.payments?.[0]?.method || "CASH",
        status: s.status,
        createdAt: s.createdAt,
      })),
      paymentBreakdown: salesByPayment.map(p => ({
        method: p.method,
        amount: Number(p._sum.amount || 0),
        count: p._count.id,
      })),
      categoryBreakdown: Object.entries(catMap).map(([category, data]) => ({
        category,
        ...data,
        revenue: Math.round(data.revenue * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
      })),
      topProducts: topProducts.map(t => ({
        productId: t.productId,
        name: nameMap[t.productId]?.name || "Unknown",
        category: nameMap[t.productId]?.category || "",
        quantity: t._sum.quantity || 0,
        revenue: Number(t._sum.price || 0),
      })),
      ...(groupBy ? {
        cashFlow: cashFlow.map(c => ({
          date: (c as any).createdAt,
          amount: Number((c as any)._sum.amount || 0),
        })),
      } : {}),
    });
  } catch (error: any) {
    logger.error("Reports API error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
