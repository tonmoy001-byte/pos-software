export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

  return NextResponse.json(customer);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Customer PUT error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id, storeId: session.user.storeId }
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
