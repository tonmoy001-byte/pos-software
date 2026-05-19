export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, checkIdempotency, markIdempotent, createIdempotencyKey, completeIdempotencyKey, extractIdempotencyKey, checkRateLimit, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "sale:refund")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { allowed, remaining, resetAt } = checkRateLimit(session.user.id, "strict");
  if (!allowed) {
    logger.warn("Rate limit hit", { userId: session.user.id, action: "refund" });
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Reset": String(resetAt) } }
    );
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

  try {
    const { reason, amount } = await req.json();

    const result = await saleService.refund(
      id,
      reason || "No reason provided",
      session.user.id,
      session.user.storeId,
      amount !== undefined ? Number(amount) : undefined
    );

    const response = NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Reset": String(resetAt) },
    });

    if (idempotencyKey) {
      await completeIdempotencyKey(idempotencyKey, session.user.storeId, result);
    }

    logger.info("Refund processed", { storeId: session.user.storeId, userId: session.user.id, saleId: id });
    return response;
  } catch (error: any) {
    logger.error("Refund failed", { storeId: session.user.storeId, userId: session.user.id, saleId: id, error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to process refund" },
      { status: 400 }
    );
  }
}
