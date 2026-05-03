export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { TransactionService, CapitalService } from "@/lib/services";

const transactionService = new TransactionService();
const capitalService = new CapitalService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "today";
  const storeId = session.user.storeId;
  const isAdmin = session.user.role === "ADMIN";
  
  let startDate: Date;
  const endDate: Date = new Date();
  
  switch (range) {
    case "week":
      startDate = subDays(endDate, 7);
      break;
    case "month":
      startDate = startOfMonth(endDate);
      break;
    case "year":
      startDate = subDays(endDate, 365);
      break;
    default:
      startDate = startOfDay(endDate);
  }

  try {
    const summary = await transactionService.getFinancialSummary(storeId, startDate, endDate, isAdmin);
    const capital = await capitalService.getCapitalSummary(storeId, isAdmin);

    const storeFilter = isAdmin ? {} : { storeId };

    const [products, customers, dues] = await Promise.all([
      prisma.product.findMany({
        where: storeFilter,
        select: { id: true, minStock: true },
      }),
      prisma.customer.findMany({ where: storeFilter, select: { id: true } }),
      prisma.customer.aggregate({
        where: storeFilter,
        _sum: { dueAmount: true },
        _count: { id: true }
      })
    ]);

    // Fetch recent sales for the range
    const recentSales = await prisma.sale.findMany({
      where: { ...storeFilter, createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return NextResponse.json({
      period: { start: startDate.toISOString(), end: endDate.toISOString(), label: range },
      summary: {
        totalSales: summary.totalSales,
        salesCount: summary.transactionCount,
        cashCollected: summary.collections,
        totalDue: summary.dueSales,
        totalExpenses: summary.expenses,
        netProfit: summary.profit,
        netCash: summary.netCash
      },
      stock: { 
        productCount: products.length, 
        stockValue: capital.ownedStockValue 
      },
      customers: {
        total: customers.length,
        totalDueOutstanding: Number(dues._sum.dueAmount || 0),
      },
      recentSales: recentSales.map(s => ({
        id: s.id,
        invoiceId: s.invoiceId,
        totalAmount: Number(s.totalAmount),
        paidAmount: Number(s.paidAmount),
        dueAmount: Number(s.dueAmount),
        createdAt: s.createdAt
      })),
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}