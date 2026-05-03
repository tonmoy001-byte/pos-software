export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateBarcode } from "@/lib/barcode";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const quantity = data.quantity ? parseInt(data.quantity) : 1;
  const cost = data.cost ? parseFloat(data.cost) : 0;

  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "Valid quantity required" }, { status: 400 });
  }

  try {
    const createdItems = [];
    
    for (let i = 0; i < quantity; i++) {
      const itemBarcode = generateBarcode();
      const item = await prisma.serializedItem.create({
        data: {
          barcode: itemBarcode,
          imei: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          cost: cost,
          productId: id,
          status: "AVAILABLE",
        }
      });
      createdItems.push(item);
    }

    return NextResponse.json({ success: true, count: createdItems.length });
  } catch (error: any) {
    console.error("Stock add error:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.serializedItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}