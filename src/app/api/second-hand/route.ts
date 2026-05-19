export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { eventStore, EventStoreData, hasPermission } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "secondhand:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const records = await prisma.secondHandRecord.findMany({
    where: { storeId: session.user.storeId },
    orderBy: { date: "desc" }
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "secondhand:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const storeId = session.user.storeId;
  const userId = session.user.id;

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.secondHandRecord.create({
      data: {
        sellerName: data.sellerName,
        fatherName: data.fatherName,
        nidNumber: data.nidNumber,
        model: data.model,
        purchasePrice: Number(data.purchasePrice),
        storeId,
        isImmutable: true,
      }
    });

    await eventStore.append({
      aggregateType: "SecondHandRecord",
      aggregateId: record.id,
      type: "CREATED",
      payload: {
        sellerName: data.sellerName,
        nidNumber: data.nidNumber,
        model: data.model,
        purchasePrice: Number(data.purchasePrice),
      },
      userId,
      storeId,
    } as EventStoreData, tx);

    const product = await tx.product.create({
      data: {
        name: data.model + " (Second Hand)",
        brand: "Used",
        model: data.model,
        category: "Second Hand",
        price: Number(data.purchasePrice) * 1.2,
        cost: Number(data.purchasePrice),
        stock: 1,
        minStock: 1,
        storeId,
      }
    });

    await eventStore.append({
      aggregateType: "Product",
      aggregateId: product.id,
      type: "CREATED",
      payload: {
        name: product.name,
        model: data.model,
        purchasePrice: Number(data.purchasePrice),
      },
      userId,
      storeId,
    } as EventStoreData, tx);

    await tx.transaction.create({
      data: {
        type: "SECONDHAND_BUY",
        amount: Number(data.purchasePrice),
        description: `Second-hand purchase: ${data.model}`,
        mode: "CASH",
        productId: product.id,
        storeId,
        userId,
        status: "COMPLETED"
      }
    });

    return { record, product };
  });

  return NextResponse.json(result);
}