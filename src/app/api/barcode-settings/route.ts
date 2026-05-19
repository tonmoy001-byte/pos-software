export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";
import type { BarcodeSettings } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await prisma.barcodeSettings.findUnique({
      where: { storeId: session.user.storeId },
    });

    if (!settings) {
      const newSettings = await prisma.barcodeSettings.create({
        data: { storeId: session.user.storeId },
      });
      return NextResponse.json(newSettings);
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    logger.error("Error in GET /api/barcode-settings", { error: error.message });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "store:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, storeId, createdAt, updatedAt, ...updateData } = body;

    const settings = await prisma.barcodeSettings.upsert({
      where: { storeId: session.user.storeId },
      update: updateData as any,
      create: { ...(updateData as any), storeId: session.user.storeId },
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    logger.error("Error in PUT /api/barcode-settings", { error: error.message });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}