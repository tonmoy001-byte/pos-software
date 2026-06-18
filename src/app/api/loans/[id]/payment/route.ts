export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { LoanService, hasPermission, checkIdempotency, markIdempotent, createIdempotencyKey, completeIdempotencyKey, extractIdempotencyKey, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import type { Role } from "@prisma/client";

const loanService = new LoanService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "loan:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session?.user?.storeId) {
    const writeCheck = await canWrite(session.user.storeId, session.user.id);
    if (!writeCheck.allowed) {
      return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
    }
  }

  const idempotencyKey = extractIdempotencyKey(req);
  if (idempotencyKey) {
    const { isDuplicate, existingResponse } = await checkIdempotency(idempotencyKey, session.user.storeId);
    if (isDuplicate) {
      return NextResponse.json(existingResponse);
    }
    await createIdempotencyKey(idempotencyKey, session.user.storeId);
  }

  const { id } = await params;
  const data = await req.json();

  try {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount is required and must be a positive number." }, { status: 400 });
    }

    const loan = await loanService.payment(
      id,
      {
        amount,
        mode: data.mode,
        note: data.note,
      },
      session.user.id,
      session.user.storeId
    );

    const response = NextResponse.json(loan);

    if (idempotencyKey) {
      await completeIdempotencyKey(idempotencyKey, session.user.storeId, loan);
    }

    return response;
  } catch (error: any) {
    logger.error("Failed to process payment", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
  }
}