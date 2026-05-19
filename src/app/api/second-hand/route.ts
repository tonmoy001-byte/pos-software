export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { eventStore, EventStoreData, hasPermission } from "@/lib/services";
import { encryptVal } from "@/lib/encryption";
import { postTransactionEntry } from "@/lib/services/posting";
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

  const storeId = session.user.storeId;
  const userId = session.user.id;

  const formData = await req.formData();
  const sellerName = formData.get("sellerName") as string;
  const fatherName = formData.get("fatherName") as string;
  const nidNumber = formData.get("nidNumber") as string;
  const phone = formData.get("phone") as string;
  const model = formData.get("model") as string;
  const imei = formData.get("imei") as string;
  const purchasePrice = formData.get("purchasePrice") as string;
  const nidPhoto = formData.get("nidPhoto") as File | null;

  if (!sellerName || !nidNumber || !model || !imei || !purchasePrice) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (nidPhoto && nidPhoto.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "NID file too large. Max 5MB" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.secondHandRecord.create({
      data: {
        sellerName,
        fatherName,
        nidNumber,
        phone,
        imei,
        model,
        purchasePrice: Number(purchasePrice),
        storeId,
        isImmutable: true,
      }
    });

    if (nidPhoto) {
      const buffer = Buffer.from(await nidPhoto.arrayBuffer());
      const encrypted = encryptVal(buffer);
      await tx.secondHandRecord.update({
        where: { id: record.id },
        data: {
          nidPhotoData: Buffer.from(encrypted.ciphertext, "base64"),
          encryptionIv: encrypted.iv,
        }
      });
    }

    await eventStore.append({
      aggregateType: "SecondHandRecord",
      aggregateId: record.id,
      type: "CREATED",
      payload: {
        sellerName,
        nidNumber,
        model,
        purchasePrice: Number(purchasePrice),
      },
      userId,
      storeId,
    } as EventStoreData, tx);

    const product = await tx.product.create({
      data: {
        name: model + " (Second Hand)",
        brand: "Used",
        model,
        category: "Second Hand",
        price: Number(purchasePrice) * 1.2,
        cost: Number(purchasePrice),
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
        model,
        purchasePrice: Number(purchasePrice),
      },
      userId,
      storeId,
    } as EventStoreData, tx);

    await tx.transaction.create({
      data: {
        type: "SECONDHAND_BUY",
        amount: Number(purchasePrice),
        description: `Second-hand purchase: ${model}`,
        mode: "CASH",
        productId: product.id,
        storeId,
        userId,
        status: "COMPLETED"
      }
    });

    await postTransactionEntry(
      "",
      "SECONDHAND_BUY",
      Number(purchasePrice),
      "CASH",
      `Second-hand purchase: ${model} from ${sellerName}`,
      storeId,
      tx
    );

    return { record, product };
  });

  return NextResponse.json(result);
}