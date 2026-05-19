export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, eventStore, EventStoreData, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id, storeId: session.user.storeId },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          items: { include: { product: { select: { name: true } } } },
          payments: { select: { amount: true, method: true, date: true } },
        }
      },
      _count: { select: { sales: true } }
    }
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Also fetch standalone payments (from customer page payment, not linked to a specific sale)
  const standalonePayments = await prisma.payment.findMany({
    where: { customerId: id },
    select: { amount: true, method: true, date: true, createdAt: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ ...customer, standalonePayments });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "customer:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, phone, address } = await req.json();

    const customer = await prisma.customer.findUnique({
      where: { id, storeId: session.user.storeId }
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name || customer.name,
        phone: phone || customer.phone,
        address: address !== undefined ? address : customer.address,
      }
    });

    await eventStore.append({
      aggregateType: "Customer",
      aggregateId: id,
      type: "UPDATED",
      payload: { name: updated.name, phone: updated.phone },
      userId: session.user.id,
      storeId: session.user.storeId,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    logger.error("Failed to update customer", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "customer:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id, storeId: session.user.storeId }
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  if (Number(customer.dueAmount) > 0) {
    return NextResponse.json(
      { error: "Cannot delete customer with outstanding dues. Clear dues first." },
      { status: 400 }
    );
  }

  // Soft delete: Update deletedAt instead of hard delete
  // This preserves sales history and audit trail
  await prisma.customer.update({
    where: { id, storeId: session.user.storeId },
    data: { deletedAt: new Date() }
  });

  await eventStore.append({
    aggregateType: "Customer",
    aggregateId: id,
    type: "DELETED",
    payload: { name: customer.name, phone: customer.phone },
    userId: session.user.id,
    storeId: session.user.storeId,
  });

  return NextResponse.json({ success: true });
}
