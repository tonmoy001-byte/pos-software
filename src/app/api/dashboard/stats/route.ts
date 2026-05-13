export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { TransactionService, CapitalService } from "@/lib/services";

const transactionService = new TransactionService();
const capitalService = new CapitalService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = session.user.storeId;
  const isAdmin = session.user.role === "ADMIN";

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
      transactionService.getFinancialSummary(storeId, startOfToday, endOfToday, isAdmin),
      capitalService.getCapitalSummary(storeId, isAdmin),
      transactionService.getFinancialSummary(storeId, startOfYesterday, endOfYesterday, isAdmin),
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

    // Build chart data from live records
    const dailyChartData: { date: string; revenue: number; profit: number; expenses: number }[] = [];
    const d = new Date(chartStartDate);
    while (d <= chartEndDate) {
      const dateStr = localDateStr(d);

      const daySales = allSales.filter(s => {
        const sDate = localDateStr(new Date(s.createdAt));
        return sDate === dateStr;
      });
      const dayExpenses = allExpenses.filter(e => {
        const eDate = localDateStr(new Date(e.createdAt));
        return eDate === dateStr;
      });

      dailyChartData.push({
        date: dateStr,
        revenue: daySales.reduce((sum, s) => sum + Number(s.totalAmount), 0),
        profit: daySales.reduce((sum, s) => sum + Number(s.profit), 0),
        expenses: dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
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
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}