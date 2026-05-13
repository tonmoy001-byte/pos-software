export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await getSession();
  } catch (e) {
    session = null;
  }
  
  if (!session) {
    return NextResponse.json({ error: "Please login to delete products" }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    // Security: Verify product belongs to user's store before delete
    const product = await prisma.product.findFirst({
      where: { id, storeId: session.user.storeId }
    });
    
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    
    await prisma.product.delete({
      where: { id },
      include: { saleItems: true }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Product delete error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete product" }, { status: 500 });
  }
}