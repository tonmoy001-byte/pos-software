export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { TransactionService } from "@/lib/services";
import { z } from "zod";

const transactionService = new TransactionService();

const transactionCreateSchema = z.object({
  type: z.enum([
    "SALE", "SALE_REFUND", "PURCHASE", "PURCHASE_RETURN",
    "DUE_PAYMENT", "HAWLAT_GIVEN", "HAWLAT_RECEIVED",
    "EXPENSE", "STOCK_IN", "SECONDHAND_BUY", "OPENING", "CLOSING"
  ]),
  amount: z.coerce.number().positive("Amount must be positive"),
  costAmount: z.coerce.number().optional(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CARD", "DUE"]).default("CASH"),
  description: z.string().optional(),
  barcode: z.string().optional(),
  productId: z.string().optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  loanId: z.string().optional(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
});

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
    const json = await req.json();
    const result = transactionCreateSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: result.error.format()
      }, { status: 400 });
    }

    const data = result.data;

    const transaction = await transactionService.create(
      {
        type: data.type as any,
        amount: data.amount,
        costAmount: data.costAmount,
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
