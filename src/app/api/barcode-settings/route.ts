export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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
  } catch (error) {
    console.error("Error in GET /api/barcode-settings:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, storeId, createdAt, updatedAt, ...updateData } = body;

    const settings = await prisma.barcodeSettings.upsert({
      where: { storeId: session.user.storeId },
      update: updateData,
      create: { ...updateData, storeId: session.user.storeId }
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error in PUT /api/barcode-settings:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
