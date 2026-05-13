export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dailyActivityService } from "@/lib/services";

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
  } catch (error) {
    console.error("Daily sheet fetch error:", error);
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
        result = await dailyActivityService.saveClosing(storeId, body.date, body.data.closingCash, body.data.notes);
        break;
      default:
        return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Daily activity POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process transaction" },
      { status: 400 }
    );
  }
}
