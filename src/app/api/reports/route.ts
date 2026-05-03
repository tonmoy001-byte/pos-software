export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "today";
  
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

  const storeFilter = session.user.role === "ADMIN" 
    ? {} 
    : { storeId: session.user.storeId };

  const [
    sales,
    expenses,
    products,
    customers,
    dues
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { ...storeFilter, createdAt: { gte: startDate, lte: endDate } },
    }),
    prisma.expense.findMany({ where: storeFilter }),
    prisma.product.findMany({
      where: storeFilter,
      select: { id: true, minStock: true },
    }),
    prisma.customer.findMany({ where: storeFilter, select: { id: true } }),
    prisma.sale.findMany({
      where: { ...storeFilter, dueAmount: { gt: 0 } },
      select: { dueAmount: true },
    }),
  ]);

  const totalSales = sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
  const cashCollected = sales.reduce((acc, s) => acc + Number(s.paidAmount), 0);
  const totalDue = sales.reduce((acc, s) => acc + Number(s.dueAmount), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  
  const totalDueOutstanding = dues.reduce((acc, d) => acc + Number(d.dueAmount), 0);

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString(), label: range },
    summary: {
      totalSales,
      salesCount: sales.length,
      cashCollected,
      totalDue,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
    },
    stock: { productCount: products.length, unitsInStock: 0 },
    customers: {
      total: customers.length,
      withDue: dues.length,
      totalDueOutstanding,
    },
    recentSales: sales.slice(0, 10),
  });
}