export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierService, logger } from "@/lib/services";

const supplierService = new SupplierService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const products = await supplierService.getProductsBySupplier(id, session.user.storeId);
    return NextResponse.json(products);
  } catch (error: any) {
    logger.error("Supplier products fetch error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
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

  try {
    const { id } = await params;
    const data = await req.json();
    
    const products = await supplierService.addProducts(id, data, session.user.storeId);
    return NextResponse.json(products);
  } catch (error: any) {
    logger.error("Supplier products add error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to add products" }, { status: 500 });
  }
}