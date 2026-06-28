export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PurchaseService, hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { z } from "zod";
import type { Role } from "@prisma/client";

const purchaseService = new PurchaseService();

const receiveSchema = z.object({
  items: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().positive(),
    imeis: z.array(z.string()).optional(),
  })).min(1, "At least one item required"),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "supplier:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const writeCheck = await canWrite(session.user.storeId, session.user.id);
  if (!writeCheck.allowed) {
    return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
  }

  try {
    const { id } = await params;
    const json = await req.json();
    const result = receiveSchema.safeParse(json);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({
        error: firstError?.message || "Validation failed",
        details: result.error.format(),
      }, { status: 400 });
    }

    const receive = await purchaseService.receivePartial(
      id,
      result.data.items,
      session.user.storeId,
      session.user.id
    );

    return NextResponse.json(receive);
  } catch (error: any) {
    logger.error("Purchase receive error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to receive purchase" }, { status: 500 });
  }
}
