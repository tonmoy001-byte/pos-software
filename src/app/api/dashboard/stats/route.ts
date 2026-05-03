export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { TransactionService, CapitalService } from "@/lib/services";

const transactionService = new TransactionService();
const capitalService = new CapitalService();

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = session.user.storeId;
  const isAdmin = session.user.role === "ADMIN";

  try {
    const summary = await transactionService.getFinancialSummary(storeId, undefined, undefined, isAdmin);
    const capital = await capitalService.getCapitalSummary(storeId, isAdmin);

    // Get recent activities (sales + transactions)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [sales, transactions, customerDues] = await Promise.all([
      prisma.sale.findMany({
        where: { storeId, createdAt: { gte: startOfDay, lte: endOfDay } },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.transaction.findMany({
        where: { storeId, createdAt: { gte: startOfDay, lte: endOfDay } },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.customer.aggregate({
        where: { storeId },
        _sum: { dueAmount: true }
      })
    ]);

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
      capital: { supplierDue: capital.supplierDue },
      customerDue: Number(customerDues._sum.dueAmount || 0),
      transactions: activities.slice(0, 20),
      salesCount: sales.length
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}