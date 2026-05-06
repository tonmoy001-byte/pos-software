export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierService } from "@/lib/services";

const supplierService = new SupplierService();

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { linkId } = await params;
    await supplierService.removeProduct(linkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Supplier product remove error:", error);
    return NextResponse.json({ error: "Failed to remove product" }, { status: 500 });
  }
}