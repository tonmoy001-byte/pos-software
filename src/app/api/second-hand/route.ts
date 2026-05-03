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
    
    // Create the immutable record
    const record = await prisma.secondHandRecord.create({
      data: {
        sellerName: data.sellerName,
        fatherName: data.fatherName,
        nidNumber: data.nidNumber,
        model: data.model,
        imei: data.imei,
        purchasePrice: Number(data.purchasePrice),
        storeId: session.user.storeId,
        isImmutable: true,
      }
    });

    // Also add this product to inventory as a second-hand item
    const product = await prisma.product.create({
      data: {
        name: data.model + " (Second Hand)",
        brand: "Used",
        model: data.model,
        category: "Second Hand",
        price: Number(data.purchasePrice) * 1.2,
        cost: Number(data.purchasePrice),
        minStock: 1,
        storeId: session.user.storeId,
        items: {
          create: {
            imei: data.imei,
            status: "AVAILABLE",
            cost: Number(data.purchasePrice)
          }
        }
      }
    });

    // Create a transaction record for the purchase
    await prisma.transaction.create({
      data: {
        type: "SECONDHAND_BUY",
        amount: Number(data.purchasePrice),
        description: `Second-hand purchase: ${data.model} (${data.imei})`,
        mode: "CASH",
        imei: data.imei,
        productId: product.id,
        storeId: session.user.storeId,
        userId: session.user.id,
        status: "COMPLETED"
      }
    });

    return NextResponse.json({ record, product });
  } catch (error: any) {
    console.error("Second hand purchase failed", error);
    if (error.code === 'P2002' && error.meta?.target?.includes('imei')) {
        return NextResponse.json({ error: "A device with this IMEI is already registered." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
  }
}
