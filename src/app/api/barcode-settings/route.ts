export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { getSession } from "@/lib/auth";

// Create a local prisma client to bypass any caching issues
const dbUrl = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const localPrisma = new PrismaClient({ adapter });

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // @ts-ignore
    const settings = await localPrisma.barcodeSettings.findUnique({
      where: { storeId: session.user.storeId }
    });

    if (!settings) {
      // @ts-ignore
      const newSettings = await localPrisma.barcodeSettings.create({
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

    // @ts-ignore
    const settings = await localPrisma.barcodeSettings.upsert({
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