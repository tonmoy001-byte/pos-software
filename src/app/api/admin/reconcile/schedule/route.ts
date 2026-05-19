export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFullReconciliation, logger } from "@/lib/services";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const apiKey = process.env.CRON_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
