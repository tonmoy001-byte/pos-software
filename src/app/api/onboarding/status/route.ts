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

  // Check if this store has any products (onboarding is "done" if products exist)
  const productCount = await prisma.product.count({
    where: { storeId: user.storeId, deletedAt: null },
  });

  return NextResponse.json({
    needsOnboarding: productCount === 0,
    productCount,
  });
}