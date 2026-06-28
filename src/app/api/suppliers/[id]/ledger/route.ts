export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "supplier:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const [supplier, transactions, payments, returns] = await Promise.all([
      prisma.supplier.findFirst({
        where: { id, storeId: session.user.storeId },
        select: { id: true, name: true, dueAmount: true },
      }),
      prisma.transaction.findMany({
        where: { supplierId: id, storeId: session.user.storeId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.supplierPayment.findMany({
        where: { supplierId: id, storeId: session.user.storeId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { purchase: { select: { purchaseId: true } } },
      }),
      prisma.supplierReturn.findMany({
        where: { supplierId: id, storeId: session.user.storeId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { product: { select: { name: true, barcode: true } } },
      }),
    ]);

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Build ledger entries (chronological merge)
    const entries = [
      ...transactions.map((t) => ({
        date: t.createdAt,
        type: t.type,
        description: t.description,
        debit: t.type === "DUE_PAYMENT" ? t.amount : 0,
        credit: t.type !== "DUE_PAYMENT" ? t.amount : 0,
      })),
      ...payments.map((p) => ({
        date: p.createdAt,
        type: "PAYMENT",
        description: `Payment - ${p.mode}${p.purchase?.purchaseId ? ` (${p.purchase.purchaseId})` : ""}`,
        debit: p.amount,
        credit: 0,
      })),
      ...returns.map((r) => ({
        date: r.createdAt,
        type: "RETURN",
        description: `Return: ${r.productName} x${r.quantity}`,
        debit: 0,
        credit: r.totalCost,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ supplier, entries });
  } catch (error: any) {
    logger.error("Supplier ledger error", { storeId: session.user.storeId, error: error.message });
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }
}
