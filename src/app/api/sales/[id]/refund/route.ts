export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService } from "@/lib/services";

const saleService = new SaleService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { reason } = await req.json();

    const result = await saleService.refund(
      id,
      reason || "No reason provided",
      session.user.id,
      session.user.storeId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Refund error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process refund" },
      { status: 400 }
    );
  }
}
