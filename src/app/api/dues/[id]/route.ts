export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService } from "@/lib/services";

const saleService = new SaleService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const sale = await saleService.findById(id);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    return NextResponse.json(sale);
  } catch (error) {
    console.error("Sale fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();

  try {
    const result = await saleService.collectPayment(
      id,
      parseFloat(data.amount),
      data.method || "CASH",
      session.user.id,
      session.user.storeId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Payment collection error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to collect payment" },
      { status: 400 }
    );
  }
}