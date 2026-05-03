export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  } catch (error) {
    console.error("Failed to fetch store:", error);
    return NextResponse.json({ error: "Failed to fetch store" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    console.log("Saving store settings:", session.user.storeId, data);
    
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
  } catch (error) {
    console.error("Failed to update store:", error);
    return NextResponse.json({ error: "Failed to update store" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return await PUT(req);
}