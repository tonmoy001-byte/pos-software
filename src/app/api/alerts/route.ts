import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  buildAlertConfig,
  sendLowStockAlert,
  sendDueReminders,
  runAllAlerts,
} from "@/lib/notifications/alert-service";
import type { Role } from "@prisma/client";
import { hasPermission } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/alerts
 *  Run a single or full alert sweep for a store.
 *  Query: ?run=all|stock|dues
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "store:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storeId = session.user.storeId;
  const url = new URL(req.url);
  const run      = url.searchParams.get("run") ?? "all";

  const cfg = buildAlertConfig();
  if (!cfg.enabled || cfg.provider === "none") {
    return NextResponse.json(
      { ok: false, error: "Alerts disabled or no provider configured.", provider: cfg.provider },
      { status: 503 }
    );
  }

  // Verify store exists
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!store) {
    return NextResponse.json({ ok: false, error: "Store not found." }, { status: 404 });
  }

  try {
    if (run === "all") {
      const result = await runAllAlerts(storeId);
      return NextResponse.json({ ok: true, run: "all", ...result });
    }

    if (run === "stock") {
      const result = await sendLowStockAlert(storeId);
      return NextResponse.json({ ok: true, run: "stock", ...result });
    }

    if (run === "dues") {
      const result = await sendDueReminders(storeId);
      return NextResponse.json({ ok: true, run: "dues", ...result });
    }

    return NextResponse.json({ ok: false, error: `Unknown run type: ${run}` }, { status: 400 });
  } catch (err) {
    console.error("[alerts] error:", err);
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
