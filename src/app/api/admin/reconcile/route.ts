export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission, runFullReconciliation } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "report:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const report = await runFullReconciliation(session.user.storeId);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Reconciliation failed" }, { status: 500 });
  }
}
