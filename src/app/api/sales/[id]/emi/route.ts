export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, logger } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

/**
 * POST /api/sales/[id]/emi
 *
 * Collect installment payments against an EMI sale.
 * Supports:
 * - Sequential payment: pay next due installment (installmentNo required)
 * - Early payoff: pay all remaining installments (payAll: true)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "sale:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: saleId } = await params;

  try {
    const body = await req.json();
    const { installmentNo, payAll, method = "CASH" } = body;

    // Verify sale exists and is EMI
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        storeId: session.user.storeId,
        saleType: "EMI",
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "EMI sale not found" }, { status: 404 });
    }

    if (sale.status === "PAID") {
      return NextResponse.json(
        { error: "This EMI sale is fully paid" },
        { status: 400 }
      );
    }

    let result;

    if (payAll) {
      // Early payoff — pay all remaining installments
      result = await saleService.payAllInstallments(
        saleId,
        method,
        session.user.id,
        session.user.storeId
      );
      return NextResponse.json({
        message: `Paid ${result.paidCount} installments. EMI fully settled.`,
        sale: result.sale,
        paidCount: result.paidCount,
        isEmiPaidOff: true,
      });
    } else {
      // Pay specific installment (sequential — next due only)
      if (!installmentNo) {
        return NextResponse.json(
          { error: "installmentNo is required" },
          { status: 400 }
        );
      }

      const installment = await prisma.eMISchedule.findFirst({
        where: { saleId, installmentNo, status: "PENDING" },
      });

      if (!installment) {
        return NextResponse.json(
          { error: `Installment #${installmentNo} not found or already paid` },
          { status: 400 }
        );
      }

      result = await saleService.payInstallment(
        saleId,
        installmentNo,
        Number(installment.amount),
        method,
        session.user.id,
        session.user.storeId
      );

      // Check if fully paid
      const pendingCount = await prisma.eMISchedule.count({
        where: { saleId, status: "PENDING" },
      });

      return NextResponse.json({
        installment: result.installment,
        sale: result.sale,
        remainingDue: Number(result.sale.dueAmount),
        status: result.sale.status,
        isEmiPaidOff: pendingCount === 0,
      });
    }
  } catch (error: any) {
    logger.error("EMI payment failed", {
      storeId: session.user.storeId,
      saleId,
      error: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to process EMI payment" },
      { status: 500 }
    );
  }
}
