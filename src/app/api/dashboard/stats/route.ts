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

  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const filter = {
      days: days ? parseInt(days) : undefined,
    };

    // Get transactions and sales for today
    const [transactions, sales, dailySummary, capitalSummary] = await Promise.all([
      transactionService.findAll(filter, session.user.storeId, session.user.role === "ADMIN"),
      prisma.sale.findMany({
        where: {
          storeId: session.user.storeId,
          createdAt: { gte: today, lt: tomorrow },
        },
        include: {
          customer: { select: { name: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      transactionService.getDailySummary(session.user.storeId, session.user.role === "ADMIN"),
      capitalService.getCapitalSummary(session.user.storeId, session.user.role === "ADMIN"),
    ]);

    // Combine transactions and sales into one activity list
    const allActivities = [
      ...transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description || tx.type,
        createdAt: tx.createdAt,
        category: tx.type === "EXPENSE" ? "expense" : "income",
      })),
      ...sales.map(sale => ({
        id: sale.id,
        type: "SALE",
        amount: sale.totalAmount,
        description: `Sale - ${sale.invoiceId}`,
        name: sale.customer?.name || "Walking Customer",
        createdAt: sale.createdAt,
        category: "income",
        details: sale,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      summary: dailySummary,
      capital: capitalSummary,
      transactions: allActivities.slice(0, 20),
      salesCount: sales.length,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}