export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "store:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId },
      include: { invoiceSettings: true }
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    let settings = store.invoiceSettings;

    if (!settings) {
      settings = await prisma.invoiceSettings.create({
        data: {
          storeId: session.user.storeId,
          general: JSON.stringify({
            businessName: store.name,
            address: store.address,
            phone: store.phone,
          }),
        },
      });
    }

    // Parse JSON strings back to objects for the client
    const parsedSettings = {
      ...settings,
      general: JSON.parse(settings.general || "{}"),
      layout: JSON.parse(settings.layout || "{}"),
      products: JSON.parse(settings.products || "{}"),
      payment: JSON.parse(settings.payment || "{}"),
      footer: JSON.parse(settings.footer || "{}"),
      print: JSON.parse(settings.print || "{}"),
    };

    return NextResponse.json(parsedSettings);
  } catch (error: any) {
    logger.error("Failed to fetch invoice settings", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch invoice settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return await PUT(req);
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "store:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session?.user?.storeId) {
    const writeCheck = await canWrite(session.user.storeId, session.user.id);
    if (!writeCheck.allowed) {
      return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
    }
  }

  try {
    const data = await req.json();
    logger.info("Saving invoice settings", { storeId: session.user.storeId, userId: session.user.id, data });

    let settings = await prisma.invoiceSettings.findUnique({
      where: { storeId: session.user.storeId }
    });

if (settings) {
      settings = await prisma.invoiceSettings.update({
        where: { storeId: session.user.storeId },
        data: {
          general: typeof data.general === "object" ? JSON.stringify(data.general) : (data.general || "{}"),
          layout: typeof data.layout === "object" ? JSON.stringify(data.layout) : (data.layout || "{}"),
          products: typeof data.products === "object" ? JSON.stringify(data.products) : (data.products || "{}"),
          payment: typeof data.payment === "object" ? JSON.stringify(data.payment) : (data.payment || "{}"),
          footer: typeof data.footer === "object" ? JSON.stringify(data.footer) : (data.footer || "{}"),
          print: typeof data.print === "object" ? JSON.stringify(data.print) : (data.print || "{}"),
        },
      });
    } else {
      settings = await prisma.invoiceSettings.create({
        data: {
          storeId: session.user.storeId,
          general: typeof data.general === "object" ? JSON.stringify(data.general) : (data.general || "{}"),
          layout: typeof data.layout === "object" ? JSON.stringify(data.layout) : (data.layout || "{}"),
          products: typeof data.products === "object" ? JSON.stringify(data.products) : (data.products || "{}"),
          payment: typeof data.payment === "object" ? JSON.stringify(data.payment) : (data.payment || "{}"),
          footer: typeof data.footer === "object" ? JSON.stringify(data.footer) : (data.footer || "{}"),
          print: typeof data.print === "object" ? JSON.stringify(data.print) : (data.print || "{}"),
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    logger.error("Failed to update invoice settings", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ 
      error: "Failed to update invoice settings",
      message: error.message 
    }, { status: 500 });
  }
}