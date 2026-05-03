export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierService } from "@/lib/services";

const supplierService = new SupplierService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const suppliers = await supplierService.findAll(session.user.storeId);
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("Suppliers fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();

    const supplier = await supplierService.create(data, session.user.storeId);
    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Supplier creation error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}