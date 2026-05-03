export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.barcodeSettings.findUnique({
    where: { storeId: session.user.storeId }
  });

  if (!settings) {
    const newSettings = await prisma.barcodeSettings.create({
      data: { storeId: session.user.storeId }
    });
    return NextResponse.json(newSettings);
  }

  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  
  const settings = await prisma.barcodeSettings.upsert({
    where: { storeId: session.user.storeId },
    update: body,
    create: { ...body, storeId: session.user.storeId }
  });

  return NextResponse.json(settings);
}