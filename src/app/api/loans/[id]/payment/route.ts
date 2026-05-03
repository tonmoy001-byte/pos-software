export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { LoanService } from "@/lib/services";

const loanService = new LoanService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();

  try {
    const loan = await loanService.payment(
      id,
      {
        amount: parseFloat(data.amount),
        mode: data.mode,
        note: data.note,
      },
      session.user.id,
      session.user.storeId
    );

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Loan payment error:", error);
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
  }
}