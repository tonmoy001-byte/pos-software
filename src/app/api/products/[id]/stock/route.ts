export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const quantity = data.quantity ? parseInt(data.quantity) : 1;

  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "Valid quantity required" }, { status: 400 });
  }

  try {
    await prisma.product.update({
      where: { id },
      data: { stock: { increment: quantity } }
    });

    return NextResponse.json({ success: true, quantity });
  } catch (error: any) {
    console.error("Stock add error:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const stock = data.stock !== undefined ? parseInt(data.stock) : null;

  if (stock === null) {
    return NextResponse.json({ error: "Stock value required" }, { status: 400 });
  }

  try {
    await prisma.product.update({
      where: { id },
      data: { stock }
    });

    return NextResponse.json({ success: true, stock });
  } catch (error: any) {
    console.error("Stock update error:", error);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}