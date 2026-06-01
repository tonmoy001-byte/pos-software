import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ needsOnboarding: false });
  }

  const user = session.user as { storeId?: string };
  if (!user.storeId) {
    return NextResponse.json({ needsOnboarding: false });
  }

  const store = await prisma.store.findUnique({
    where: { id: user.storeId },
    select: { onboardingComplete: true },
  });

  return NextResponse.json({
    needsOnboarding: store ? !store.onboardingComplete : false,
  });
}