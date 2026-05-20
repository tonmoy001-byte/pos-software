export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFullReconciliation, logger, hasPermission } from "@/lib/services";
import { getSession } from "@/lib/auth";
import type { Role } from "@prisma/client";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const apiKey = process.env.CRON_API_KEY;

  // Require either valid CRON_API_KEY or authenticated admin session
  if (apiKey) {
    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const session = await getSession();
    if (!session || !hasPermission(session.user.role as Role, "admin:all")) {
      return NextResponse.json({ error: "Unauthorized — CRON_API_KEY not configured and no admin session" }, { status: 401 });
    }
  }

  const stores = await prisma.store.findMany({ select: { id: true } });
  const results: any[] = [];

  for (const store of stores) {
    try {
      const report = await runFullReconciliation(store.id);
      results.push({ storeId: store.id, status: report.hasIssues ? "issues" : "ok" });
      if (report.hasIssues) {
        logger.warn("Scheduled reconciliation found issues", { storeId: store.id, items: report.items.filter(i => i.status !== "match").map(i => i.label) });
      }
    } catch (error: any) {
      results.push({ storeId: store.id, status: "error", error: error.message });
      logger.error("Scheduled reconciliation failed", { storeId: store.id, error: error.message });
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
