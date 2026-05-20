export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, eventStore, EventStoreData, logger } from "@/lib/services";
import { generateBarcode } from "@/lib/barcode";
import { z } from "zod";
import type { Role } from "@prisma/client";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  model: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  price: z.union([z.number(), z.string()]).transform((v) => parseFloat(v.toString()) || 0),
  cost: z.union([z.number(), z.string()]).optional().transform((v) => v ? parseFloat(v.toString()) : 0),
  stock: z.union([z.number(), z.string()]).optional().transform((v) => v ? parseInt(v.toString()) : 0),
  minStock: z.union([z.number(), z.string()]).optional().transform((v) => v ? parseInt(v.toString()) : 5),
  barcode: z.string().optional(),
  storage: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  imei: z.string().nullable().optional(),
  warranty: z.union([z.number(), z.string()]).nullable().optional().transform((v) => v ? parseInt(v.toString()) : null),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "product:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const skip = (page - 1) * limit;

  const where: any = { storeId: session.user.storeId, deletedAt: null };
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search } },
      { model: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip,
    }),
    prisma.product.count({ where }),
  ]);

  // Optimize: Calculate advanceOrderQuantity using an aggregated query
  const advanceOrderStats = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        storeId: session.user.storeId,
        saleType: "ADVANCE_ORDER",
        status: { notIn: ["COMPLETED", "CANCELLED"] }
      }
    },
    _sum: {
      quantity: true
    }
  });

  const advanceOrderMap = new Map<string, number>();
  for (const stat of advanceOrderStats) {
    advanceOrderMap.set(stat.productId, stat._sum.quantity || 0);
  }

  const productsWithAdvanceInfo = products.map(p => ({
    ...p,
    advanceOrderQuantity: advanceOrderMap.get(p.id) || 0
  }));

  return NextResponse.json({
    products: productsWithAdvanceInfo,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "product:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const result = productSchema.safeParse(json);
    
    if (!result.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: result.error.format()
      }, { status: 400 });
    }
    
    const data = result.data;
    if (data.cost && data.price <= data.cost) {
      return NextResponse.json({ error: "Price must be greater than cost" }, { status: 400 });
    }
    const productBarcode = data.barcode || generateBarcode();
    
    const product = await prisma.product.create({
      data: {
        name: data.name,
        model: data.model && data.model.trim() ? data.model.trim() : data.name,
        brand: data.brand && data.brand.trim() ? data.brand.trim() : "Generic",
        category: (data.category || "SMARTPHONE").toUpperCase(),
        price: data.price,
        cost: data.cost,
        stock: data.stock,
        minStock: data.minStock,
        barcode: productBarcode,
        storage: data.storage || null,
        color: data.color || null,
        imei: data.imei || null,
        warranty: data.warranty,
        storeId: session.user.storeId,
      }
    });

    await eventStore.append({
      aggregateType: "Product",
      aggregateId: product.id,
      type: "CREATED",
      payload: {
        name: product.name,
        brand: product.brand,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
      },
      userId: session.user.id,
      storeId: session.user.storeId,
    });

    return NextResponse.json(product);
  } catch (error: any) {
    logger.error("Failed to create product", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
