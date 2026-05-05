export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { TransactionService } from "@/lib/services";

const transactionService = new TransactionService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const days = searchParams.get("days");

  try {
    const filter = {
      type: type as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      days: days ? parseInt(days) : undefined,
    };

    const transactions = await transactionService.findAll(
      filter,
      session.user.storeId,
      session.user.role === "ADMIN"
    );

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();

    const transaction = await transactionService.create(
      {
        type: data.type,
        amount: parseFloat(data.amount),
        costAmount: data.costAmount ? parseFloat(data.costAmount) : undefined,
        mode: data.mode,
        description: data.description,
        barcode: data.barcode,
        productId: data.productId,
        customerId: data.customerId,
        supplierId: data.supplierId,
        loanId: data.loanId,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
      },
      session.user.id,
      session.user.storeId
    );

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Transaction creation error:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}