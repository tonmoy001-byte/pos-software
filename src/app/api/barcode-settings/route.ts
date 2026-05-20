export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";
import type { BarcodeSettings } from "@prisma/client";
import { z } from "zod";

const barcodeSettingsSchema = z.object({
  barcodeType: z.enum(["CODE128", "EAN13", "UPC", "QR"]).optional(),
  labelWidth: z.number().int().min(10).max(200).optional(),
  labelHeight: z.number().int().min(10).max(200).optional(),
  labelSizeName: z.string().max(50).optional(),
  showProductName: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  showSku: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
  showQrCode: z.boolean().optional(),
  showWarranty: z.boolean().optional(),
  includeCurrency: z.boolean().optional(),
  fontSize: z.number().int().min(6).max(24).optional(),
  compactMode: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "store:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const parsed = barcodeSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const settings = await prisma.barcodeSettings.upsert({
      where: { storeId: session.user.storeId },
      update: parsed.data,
      create: { ...parsed.data, storeId: session.user.storeId },
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