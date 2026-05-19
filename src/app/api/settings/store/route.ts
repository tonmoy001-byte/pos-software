export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        description: true,
        taxId: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    return NextResponse.json(store);
  } catch (error: any) {
    logger.error("Failed to fetch store", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch store" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "store:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await req.json();
    logger.info("Saving store settings", { storeId: session.user.storeId, userId: session.user.id, data });
    
    const store = await prisma.store.update({
      where: { id: session.user.storeId },
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        description: data.description,
        taxId: data.taxId,
      },
    });

    return NextResponse.json(store);
  } catch (error: any) {
    logger.error("Failed to update store", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to update store" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return await PUT(req);
}