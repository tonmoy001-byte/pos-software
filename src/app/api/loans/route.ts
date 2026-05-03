export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { LoanService } from "@/lib/services";

const loanService = new LoanService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") as "active" | "settled" | null;

  try {
    const loans = await loanService.findAll(session.user.storeId, filter || undefined);
    return NextResponse.json(loans);
  } catch (error) {
    console.error("Loans fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();

    const loan = await loanService.create(
      {
        personName: data.personName,
        type: data.type,
        amount: parseFloat(data.amount),
        mode: data.mode,
        description: data.description,
      },
      session.user.storeId,
      session.user.id
    );

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Loan creation error:", error);
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 });
  }
}