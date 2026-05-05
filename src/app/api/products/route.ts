export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateBarcode } from "@/lib/barcode";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const category = searchParams.get("category");

  const where: any = { storeId: session.user.storeId };
  
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { barcode: { contains: search } },
      { model: { contains: search } },
    ];
  }
  if (category) where.category = category;

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" }
  });

  const advanceOrderItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        storeId: session.user.storeId,
        saleType: "ADVANCE_ORDER",
        status: { notIn: ["COMPLETED", "CANCELLED"] }
      }
    },
    select: { productId: true, quantity: true }
  });

  const advanceOrderMap = new Map<string, number>();
  for (const item of advanceOrderItems) {
    const current = advanceOrderMap.get(item.productId) || 0;
    advanceOrderMap.set(item.productId, current + item.quantity);
  }

  const productsWithAdvanceInfo = products.map(p => ({
    ...p,
    advanceOrderQuantity: advanceOrderMap.get(p.id) || 0
  }));

  return NextResponse.json(productsWithAdvanceInfo);
}

export async function POST(req: Request) {
  console.log("POST /api/products - Starting");
  const session = await getSession();
  console.log("Session:", session);
  
  if (!session) return NextResponse.json({ error: "Unauthorized - no session" }, { status: 401 });

  try {
    const data = await req.json();
    
    if (!data.name || !data.price) {
      return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
    }
    
    const productBarcode = generateBarcode();
    
    const product = await prisma.product.create({
      data: {
        name: data.name,
        model: data.model || data.name,
        brand: data.brand || "",
        category: data.category || "Mobile",
        price: parseFloat(data.price) || 0,
        cost: data.cost ? parseFloat(data.cost) : 0,
        stock: data.stock ? parseInt(data.stock) : 0,
        minStock: parseInt(data.minStock) || 5,
        barcode: productBarcode,
        storeId: session.user.storeId,
      }
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}