export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, eventStore, EventStoreData, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { generateBarcode } from "@/lib/barcode";
import { z } from "zod";
import type { Role } from "@prisma/client";

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().min(1, "SKU is required").max(80),
  category: z.string().min(1, "Category is required").max(80),
  productType: z.enum(["SERIALIZED", "NON_SERIALIZED", "SERVICE"]),

  barcode: z.string().max(80).optional().nullable(),
  brand: z.string().max(80).optional().nullable(),
  modelNumber: z.string().max(80).optional().nullable(),
  condition: z.enum(["NEW", "USED", "REFURBISHED"]).optional().nullable(),
  ram: z.string().max(20).optional().nullable(),
  storage: z.string().max(20).optional().nullable(),
  network: z.string().max(20).optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),

  price: z.coerce.number().min(0, "Selling price cannot be negative"),
  cost: z.coerce.number().min(0, "Cost price cannot be negative"),
  taxVat: z.coerce.number().min(0).max(100).optional().default(0),
  unit: z.enum(["PIECE", "BOX", "PACK", "SET"]).optional().default("PIECE"),

  stock: z.coerce.number().int().min(0).optional().default(0),
  openingCost: z.coerce.number().min(0).optional().default(0),
  warehouse: z.string().max(80).optional().nullable(),
  minStock: z.coerce.number().int().min(0).optional().default(5),
  reorderQuantity: z.coerce.number().int().min(0).optional().default(0),
  trackImei: z.boolean().optional().default(false),

  defaultSupplier: z.string().uuid().optional().nullable(),
  purchaseWarrantyMonths: z.coerce.number().int().min(0).optional().default(0),
  salesWarrantyMonths: z.coerce.number().int().min(0).optional().default(0),
  warranty: z.coerce.number().int().min(0).optional().nullable(),

  imageUrl: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional().default("ACTIVE"),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
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

  if (session?.user?.storeId) {
    const writeCheck = await canWrite(session.user.storeId);
    if (!writeCheck.allowed) {
      return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
    }
  }

  try {
    const json = await req.json();
    const result = productSchema.safeParse(json);

    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({
        error: firstError?.message || "Validation failed",
        field: firstError?.path?.[0],
        details: result.error.format()
      }, { status: 400 });
    }

    const data = result.data;

    if (data.cost > 0 && data.price < data.cost) {
      return NextResponse.json({
        error: "Selling price must be greater than or equal to cost price",
        field: "price"
      }, { status: 400 });
    }

    const productBarcode = data.barcode || data.sku || generateBarcode();

    const metadata: Record<string, any> = {
      productType: data.productType,
      modelNumber: data.modelNumber || null,
      condition: data.condition || null,
      ram: data.ram || null,
      network: data.network || null,
      openingCost: data.openingCost || 0,
      reorderQuantity: data.reorderQuantity || 0,
      trackImei: !!data.trackImei,
      purchaseWarrantyMonths: data.purchaseWarrantyMonths || 0,
      salesWarrantyMonths: data.salesWarrantyMonths || 0,
      imageUrl: data.imageUrl || null,
      status: data.status || "ACTIVE",
      tags: data.tags || [],
      taxVat: data.taxVat || 0,
      unit: data.unit || "PIECE",
      warehouse: data.warehouse || null,
      defaultSupplier: data.defaultSupplier || null,
    };

    const product = await prisma.product.create({
      data: {
        name: data.name,
        model: data.modelNumber && data.modelNumber.trim() ? data.modelNumber.trim() : (data.brand || data.name),
        brand: data.brand && data.brand.trim() ? data.brand.trim() : "Generic",
        category: (data.category || "SMARTPHONE").toUpperCase(),
        price: data.price,
        cost: data.cost,
        profit: data.price - data.cost,
        stock: data.stock || 0,
        minStock: data.minStock || 5,
        barcode: productBarcode,
        storage: data.storage || null,
        color: data.color || null,
        imei: null,
        warranty: data.warranty || null,
        storeId: session.user.storeId,
        metadata: metadata as any,
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
        sku: data.sku,
      },
      userId: session.user.id,
      storeId: session.user.storeId,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    logger.error("Failed to create product", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
