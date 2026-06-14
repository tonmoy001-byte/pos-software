export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission, logger } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const sale = await prisma.sale.findFirst({
      where: {
        id,
        storeId: session.user.storeId,
        saleType: "EMI",
      },
      include: {
        customer: true,
        emiSchedules: {
          orderBy: { installmentNo: "asc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        items: {
          include: { product: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "EMI sale not found" }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    logger.error("Failed to fetch EMI sale", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Failed to fetch EMI sale" },
      { status: 500 }
    );
  }
}
