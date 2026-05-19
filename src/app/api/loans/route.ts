export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { LoanService, hasPermission, logger } from "@/lib/services";
import { z } from "zod";
import type { Role } from "@prisma/client";

const loanService = new LoanService();

const createLoanSchema = z.object({
  personName: z.string().min(1, "Person name is required").max(100),
  type: z.enum(["GIVE", "TAKE"]),
  amount: z.string().or(z.number()).refine((val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return !isNaN(num) && num > 0;
  }, { message: "Amount must be a positive number" }),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CARD"]).default("CASH"),
  description: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "loan:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") as "active" | "settled" | null;

  try {
    const loans = await loanService.findAll(session.user.storeId, filter || undefined);
    return NextResponse.json(loans);
  } catch (error: any) {
    logger.error("Failed to fetch loans", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "loan:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createLoanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { personName, type, amount, mode, description } = parsed.data;
    const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;

    const loan = await loanService.create(
      {
        personName,
        type,
        amount: amountNum,
        mode,
        description,
      },
      session.user.storeId,
      session.user.id
    );

    return NextResponse.json(loan);
  } catch (error: any) {
    logger.error("Failed to create loan", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 });
  }
}