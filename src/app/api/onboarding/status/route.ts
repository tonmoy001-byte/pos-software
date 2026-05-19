import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/onboarding/status
 * Returns whether the shop has completed initial setup.
 * - no users → true  (conceptually a new installation)
 * - every other case → false
 */
export async function GET() {
  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch { /* ignore */ }

  return NextResponse.json({
    needsOnboarding: userCount === 0,
    userCount,
  });
}
