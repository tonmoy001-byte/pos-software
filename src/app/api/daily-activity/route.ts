export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dailyActivityService, hasPermission, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { z } from "zod";
import type { Role } from "@prisma/client";

const dailyActivitySchema = z.object({
  type: z.enum(["SALE", "PURCHASE", "EXPENSE", "HAWLAT", "ADVANCE", "DUE", "CLOSING"]),
  date: z.string().optional(),
  data: z.unknown().optional(),
});

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

  if (session?.user?.storeId) {
    const writeCheck = await canWrite(session.user.storeId, session.user.id);
    if (!writeCheck.allowed) {
      return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const parsed = dailyActivitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const storeId = session.user.storeId;
    const userId = session.user.id;

    // Check permissions based on transaction type
    switch (parsed.data.type) {
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
      case "ADVANCE":
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
    if (parsed.data.type !== "CLOSING") {
      const today = new Date();
      const dateStr = parsed.data.date || today.toISOString().split("T")[0];
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
    switch (parsed.data.type) {
      case "SALE":
        result = await dailyActivityService.recordSale(storeId, userId, parsed.data.data as any);
        break;
      case "PURCHASE":
        result = await dailyActivityService.recordPurchase(storeId, userId, parsed.data.data as any);
        break;
      case "EXPENSE":
        result = await dailyActivityService.recordExpense(storeId, userId, parsed.data.data as any);
        break;
      case "HAWLAT":
        result = await dailyActivityService.recordHawlat(storeId, userId, parsed.data.data as any);
        break;
      case "ADVANCE":
        result = await dailyActivityService.recordAdvance(storeId, userId, parsed.data.data as any);
        break;
      case "DUE":
        result = await dailyActivityService.recordDueCollection(storeId, userId, parsed.data.data as any);
        break;
      case "CLOSING":
        const closingData = parsed.data.data as any;
        result = await dailyActivityService.saveClosing(storeId, userId, parsed.data.date || new Date().toISOString().split("T")[0], closingData?.closingCash, closingData?.notes);
        break;
      default:
        return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error("Failed to process transaction", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    const isClientError = error.message?.includes("not found") || error.message?.includes("required") || error.message?.includes("invalid") || error.message?.includes("Insufficient");
    return NextResponse.json(
      { error: isClientError ? error.message : "Failed to process transaction" },
      { status: isClientError ? 400 : 500 }
    );
  }
}
