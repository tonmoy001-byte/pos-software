export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { LoanService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const loanService = new LoanService();

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
  } catch (error: any) {
    logger.error("Failed to create loan", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 });
  }
}