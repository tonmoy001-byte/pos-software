export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dailyActivityService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const sheet = await dailyActivityService.getSheet(session.user.storeId, date);
    return NextResponse.json(sheet);
  } catch (error: any) {
    logger.error("Failed to fetch daily sheet", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch daily sheet" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const storeId = session.user.storeId;
    const userId = session.user.id;

    // Check permissions based on transaction type
    switch (body.type) {
      case "SALE":
        if (!hasPermission(session.user.role as Role, "sale:create")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        break;
      case "PURCHASE":
      case "EXPENSE":
        if (!hasPermission(session.user.role as Role, "transaction:create")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        break;
      case "HAWLAT":
        if (!hasPermission(session.user.role as Role, "loan:create")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        break;
      case "DUE":
        if (!hasPermission(session.user.role as Role, "sale:create")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        break;
      case "CLOSING":
        if (!hasPermission(session.user.role as Role, "cash:closing")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        break;
    }

    // Check if day is locked (skip for CLOSING type which is the locking action itself)
    if (body.type !== "CLOSING") {
      const today = new Date();
      const dateStr = body.date || today.toISOString().split("T")[0];
      const dayStart = new Date(dateStr + "T00:00:00");
      const balance = await prisma.dailyBalance.findUnique({
        where: { storeId_date: { storeId, date: dayStart } },
        select: { isLocked: true },
      });
      if (balance?.isLocked) {
        return NextResponse.json(
          { error: "This day is locked. No new transactions allowed." },
          { status: 403 }
        );
      }
    }

    let result;
    switch (body.type) {
      case "SALE":
        result = await dailyActivityService.recordSale(storeId, userId, body.data);
        break;
      case "PURCHASE":
        result = await dailyActivityService.recordPurchase(storeId, userId, body.data);
        break;
      case "EXPENSE":
        result = await dailyActivityService.recordExpense(storeId, userId, body.data);
        break;
      case "HAWLAT":
        result = await dailyActivityService.recordHawlat(storeId, userId, body.data);
        break;
      case "ADVANCE":
        result = await dailyActivityService.recordAdvance(storeId, userId, body.data);
        break;
      case "DUE":
        result = await dailyActivityService.recordDueCollection(storeId, userId, body.data);
        break;
      case "CLOSING":
        result = await dailyActivityService.saveClosing(storeId, userId, body.date, body.data.closingCash, body.data.notes);
        break;
      default:
        return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error("Failed to process transaction", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to process transaction" },
      { status: 400 }
    );
  }
}
