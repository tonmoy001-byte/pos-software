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
    include: {
      _count: {
        select: { items: { where: { status: "AVAILABLE" } } }
      },
      items: {
        where: { status: "AVAILABLE" },
        select: { imei: true, barcode: true, id: true, cost: true }
      }
    },
    orderBy: { name: "asc" }
  });

  return NextResponse.json(products);
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
        minStock: parseInt(data.minStock) || 5,
        barcode: productBarcode,
        storeId: session.user.storeId,
      },
      include: {
        items: true
      }
    });

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        const itemBarcode = generateBarcode();
        await prisma.serializedItem.create({
          data: {
            barcode: itemBarcode,
            imei: item.imei,
            cost: item.cost,
            productId: product.id,
            status: "AVAILABLE",
          }
        });
      }
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}