export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/services/rateLimiter";

function getIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export async function GET(req: Request) {
  // Rate limit health checks to prevent abuse
  const ip = getIpFromRequest(req);
  const { allowed } = checkRateLimit(ip, "default");
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const checks: Record<string, string> = {};

  checks.server = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const healthy = Object.values(checks).every(v => v === "ok");

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
