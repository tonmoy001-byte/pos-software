import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { storeId } = body;

  if (!storeId) {
    return NextResponse.json({ error: "Store ID required" }, { status: 400 });
  }

  const store = await prisma.store.update({
    where: { id: storeId },
    data: { status: "active" },
  });

  return NextResponse.json({
    success: true,
    message: "Store approved",
    data: { storeId: store.id },
  });
}
