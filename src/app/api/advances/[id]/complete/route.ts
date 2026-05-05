import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: saleId } = await params;
    const body = await req.json();
    const paidAmount = Number(body.paidAmount);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    if (sale.saleType !== "ADVANCE_ORDER") {
      return NextResponse.json(
        { error: "This is not an advance order" },
        { status: 400 }
      );
    }

    if (sale.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Order already completed" },
        { status: 400 }
      );
    }

    if (sale.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cancelled order cannot be completed" },
        { status: 400 }
      );
    }

    const totalAmount = Number(sale.totalAmount);
    const alreadyPaid = Number(sale.paidAmount);
    const remainingAmount = totalAmount - alreadyPaid;

    if (!paidAmount || paidAmount <= 0) {
      return NextResponse.json(
        { error: "Paid amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (paidAmount > remainingAmount) {
      return NextResponse.json(
        { error: "Paid amount exceeds remaining due" },
        { status: 400 }
      );
    }

    const newPaidTotal = alreadyPaid + paidAmount;
    const newDue = totalAmount - newPaidTotal;

    const isFullyPaid = newDue <= 0.01;
    const newStatus: "PARTIAL" | "COMPLETED" = isFullyPaid ? "COMPLETED" : "PARTIAL";

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: paidAmount,
          method: body.method || "CASH",
          storeId: sale.storeId,
        },
      });

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          paidAmount: newPaidTotal,
          dueAmount: Math.max(0, newDue),
          status: newStatus,
        },
      });
    });

    if (newStatus === "COMPLETED") {
      for (const item of sale.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message:
        newStatus === "COMPLETED"
          ? "Order completed successfully"
          : "Partial payment received",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}