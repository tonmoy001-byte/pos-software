export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, logger, isSuperAdmin } from "@/lib/services";
import { SaleService, CapitalService, TransactionService } from "@/lib/services";
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

  const storeId = session.user.storeId;
  const isCrossStoreAdmin = isSuperAdmin(session.user.id);

  const { searchParams } = new URL(req.url);
  const chartStartParam = searchParams.get("start");
  const chartEndParam = searchParams.get("end");

  function localDateStr(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday);
    endOfYesterday.setMilliseconds(-1);

    // Get financial summaries
    const [summary, capital, yesterdaySummary] = await Promise.all([
      transactionService.getFinancialSummary(storeId, startOfToday, endOfToday, isCrossStoreAdmin),
      capitalService.getCapitalSummary(storeId, isCrossStoreAdmin),
      transactionService.getFinancialSummary(storeId, startOfYesterday, endOfYesterday, isCrossStoreAdmin),
    ]);

    // Get today's recent activities (sales + transactions)
    const [sales, transactions, customerDues] = await Promise.all([
      prisma.sale.findMany({
        where: { storeId, createdAt: { gte: startOfToday, lte: endOfToday } },
        include: { customer: { select: { name: true, phone: true } } },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.transaction.findMany({
        where: { storeId, createdAt: { gte: startOfToday, lte: endOfToday } },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.customer.aggregate({
        where: { storeId },
        _sum: { dueAmount: true }
      })
    ]);

    // Get daily revenue data from live records
    const chartStartDate = chartStartParam ? new Date(chartStartParam + "T00:00:00") : new Date(startOfToday);
    const chartEndDate = chartEndParam ? new Date(chartEndParam + "T23:59:59") : new Date(endOfToday);

    if (!chartStartParam) {
      chartStartDate.setDate(chartStartDate.getDate() - 6);
    }

    // Fetch all sales and expense transactions in the chart range
    const [allSales, allExpenses] = await Promise.all([
      prisma.sale.findMany({
        where: { storeId, createdAt: { gte: chartStartDate, lte: chartEndDate } },
        select: { createdAt: true, totalAmount: true, profit: true, paidAmount: true, dueAmount: true },
      }),
      prisma.transaction.findMany({
        where: { storeId, type: "EXPENSE", createdAt: { gte: chartStartDate, lte: chartEndDate } },
        select: { createdAt: true, amount: true },
      }),
    ]);

    // Build chart data from live records using single-pass aggregation
    const salesByDate = new Map<string, { revenue: number; profit: number }>();
    for (const s of allSales) {
      const dateStr = localDateStr(new Date(s.createdAt));
      const existing = salesByDate.get(dateStr) || { revenue: 0, profit: 0 };
      existing.revenue += Number(s.totalAmount);
      existing.profit += Number(s.profit);
      salesByDate.set(dateStr, existing);
    }

    const expensesByDate = new Map<string, number>();
    for (const e of allExpenses) {
      const dateStr = localDateStr(new Date(e.createdAt));
      expensesByDate.set(dateStr, (expensesByDate.get(dateStr) || 0) + Number(e.amount));
    }

    const dailyChartData: { date: string; revenue: number; profit: number; expenses: number }[] = [];
    const d = new Date(chartStartDate);
    while (d <= chartEndDate) {
      const dateStr = localDateStr(d);
      const daySales = salesByDate.get(dateStr) || { revenue: 0, profit: 0 };
      dailyChartData.push({
        date: dateStr,
        revenue: daySales.revenue,
        profit: daySales.profit,
        expenses: expensesByDate.get(dateStr) || 0,
      });
      d.setDate(d.getDate() + 1);
    }

    // Get low stock products
    const allProducts = await prisma.product.findMany({
      where: { storeId },
      select: { id: true, name: true, model: true, stock: true, minStock: true },
    });

    const lowStockProducts = allProducts
      .filter(p => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    const activities = [
      ...sales.map(s => ({
        id: s.id, type: "SALE", amount: Number(s.totalAmount),
        description: s.invoiceId, customer: s.customer?.name || "Walking",
        createdAt: s.createdAt
      })),
      ...transactions.map(t => ({
        id: t.id, type: t.type, amount: Number(t.amount),
        description: t.description || t.type, supplier: t.supplier?.name,
        createdAt: t.createdAt
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      summary,
      yesterdaySummary: {
        totalSales: Number(yesterdaySummary.totalSales || 0),
        profit: Number(yesterdaySummary.profit || 0),
        expenses: Number(yesterdaySummary.expenses || 0),
        collections: Number(yesterdaySummary.collections || 0),
      },
      capital: {
        supplierDue: capital.supplierDue,
        netCash: summary.netCash,
      },
      customerDue: Number(customerDues._sum.dueAmount || 0),
      transactions: activities.slice(0, 20),
      salesCount: sales.length,
      dailyChartData,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        model: p.model,
        stock: p.stock,
        minStock: p.minStock,
      })),
    });
  } catch (error: any) {
    logger.error("Dashboard stats error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}