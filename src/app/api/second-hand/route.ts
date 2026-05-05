export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await prisma.secondHandRecord.findMany({
    where: { storeId: session.user.storeId },
    orderBy: { date: "desc" }
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await req.json();
    
    const record = await prisma.secondHandRecord.create({
      data: {
        sellerName: data.sellerName,
        fatherName: data.fatherName,
        nidNumber: data.nidNumber,
        model: data.model,
        purchasePrice: Number(data.purchasePrice),
        storeId: session.user.storeId,
        isImmutable: true,
      }
    });

    const product = await prisma.product.create({
      data: {
        name: data.model + " (Second Hand)",
        brand: "Used",
        model: data.model,
        category: "Second Hand",
        price: Number(data.purchasePrice) * 1.2,
        cost: Number(data.purchasePrice),
        stock: 1,
        minStock: 1,
        storeId: session.user.storeId,
      }
    });

    await prisma.transaction.create({
      data: {
        type: "SECONDHAND_BUY",
        amount: Number(data.purchasePrice),
        description: `Second-hand purchase: ${data.model}`,
        mode: "CASH",
        productId: product.id,
        storeId: session.user.storeId,
        userId: session.user.id,
        status: "COMPLETED"
      }
    });

    return NextResponse.json({ record, product });
  } catch (error: any) {
    console.error("Second hand purchase failed", error);
    return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
  }
}