export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = session.user.storeId;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const sales = await prisma.sale.findMany({
    where: { storeId, createdAt: { gte: startOfDay, lte: endOfDay } },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  const transactions = await prisma.transaction.findMany({
    where: { storeId, createdAt: { gte: startOfDay, lte: endOfDay } },
    include: { supplier: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  const payments = await prisma.payment.findMany({
    where: { storeId, date: { gte: startOfDay, lte: endOfDay } }
  });

  const expenses = await prisma.expense.findMany({
    where: { storeId, createdAt: { gte: startOfDay, lte: endOfDay } }
  });

  const totalSales = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const paidSales = sales.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
  const collections = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const expenseAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const txExpenses = transactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpenses = expenseAmount + txExpenses;
  const netCash = paidSales + collections - totalExpenses;

  const customerDues = await prisma.customer.aggregate({
    where: { storeId },
    _sum: { dueAmount: true }
  });

  const supplierDues = await prisma.supplier.aggregate({
    where: { storeId },
    _sum: { dueAmount: true }
  });

  const activities = [...sales.map(sale => ({
    id: sale.id, type: "SALE", amount: sale.totalAmount,
    description: sale.invoiceId, customer: sale.customer?.name || "Walking",
    createdAt: sale.createdAt
  })), ...transactions.map(tx => ({
    id: tx.id, type: tx.type, amount: tx.amount,
    description: tx.description || tx.type, supplier: tx.supplier?.name,
    createdAt: tx.createdAt
  }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    summary: { totalSales, cashSales: paidSales, dueSales: totalSales - paidSales, collections, expenses: totalExpenses, netCash },
    capital: { supplierDue: Number(supplierDues._sum.dueAmount || 0) },
    customerDue: Number(customerDues._sum.dueAmount || 0),
    transactions: activities.slice(0, 20),
    salesCount: sales.length
  });
}