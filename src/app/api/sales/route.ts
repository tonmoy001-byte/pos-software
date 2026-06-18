export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission, checkIdempotency, markIdempotent, createIdempotencyKey, completeIdempotencyKey, extractIdempotencyKey, checkRateLimit, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
import { z } from "zod";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  price: z.coerce.number().nonnegative("Price cannot be negative"),
  cost: z.coerce.number().nonnegative().optional(),
  imeis: z.array(z.string()).optional(),
});

const exchangeItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  estimatedValue: z.coerce.number().nonnegative(),
  condition: z.enum(["like-new", "good", "fair", "poor"]).default("good"),
});

const saleCreateSchema = z.object({
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  customerId: z.string().nullable().optional(),
  totalAmount: z.coerce.number().nonnegative(),
  paidAmount: z.coerce.number().nonnegative(),
  dueAmount: z.coerce.number().nonnegative(),
  paymentMethod: z.string().optional().default("CASH"),
  discount: z.coerce.number().nonnegative().optional().default(0),
  saleType: z.string().optional().default("REGULAR"),
  deliveryDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  exchangeItems: z.array(exchangeItemSchema).optional().default([]),
  emiMonths: z.coerce.number().int().min(3).max(12).optional(),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  downPayment: z.coerce.number().nonnegative().optional(),
  monthlyAmount: z.coerce.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden: Missing sale:view permission" }, { status: 403 });
  }

  try {
    const storeId = session.user.storeId;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const status = searchParams.get("status") || undefined;

    const { sales, total, totalPages } = await saleService.findAll(storeId, { page, limit, status });
    
    const formattedSales = sales.map((sale: any) => ({
      id: sale.id,
      invoiceId: sale.invoiceId,
      saleType: sale.saleType || "REGULAR",
      customerName: sale.customer?.name || sale.customerName || "Walking Customer",
      customerPhone: sale.customer?.phone || null,
      items: sale.items.map((item: any) => ({
        id: item.id,
        name: item.product?.name || "Unknown Product",
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      discount: Number(sale.discount) || 0,
      paymentMethod: sale.payments?.[0]?.method || "CASH",
      status: sale.status,
      createdAt: sale.createdAt?.toISOString(),
    }));

    return NextResponse.json({
      sales: formattedSales,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    });
  } catch (error: any) {
    logger.error("Failed to fetch sales", { error: error.message });
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "sale:create")) {
    return NextResponse.json({ error: "Forbidden: Missing sale:create permission" }, { status: 403 });
  }

  if (session?.user?.storeId) {
    const writeCheck = await canWrite(session.user.storeId);
    if (!writeCheck.allowed) {
      return NextResponse.json({ error: writeCheck.reason }, { status: 403 });
    }
  }

  const { allowed, remaining, resetAt } = checkRateLimit(session.user.id, "default");
  if (!allowed) {
    logger.warn("Rate limit hit", { userId: session.user.id, action: "create_sale" });
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Reset": String(resetAt) } }
    );
  }

  const idempotencyKey = extractIdempotencyKey(req);
  if (idempotencyKey) {
    const { isDuplicate, existingResponse } = await checkIdempotency(idempotencyKey, session.user.storeId);
    if (isDuplicate) {
      return NextResponse.json(existingResponse);
    }
    await createIdempotencyKey(idempotencyKey, session.user.storeId);
  }

  try {
    const json = await req.json();
    const result = saleCreateSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: result.error.format()
      }, { status: 400 });
    }

    const data = result.data;

    const sale = await saleService.create({
      items: data.items,
      customerId: data.customerId || undefined,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      dueAmount: data.dueAmount,
      paymentMethod: data.paymentMethod,
      discount: data.discount,
      saleType: data.saleType,
      deliveryDate: data.deliveryDate || null,
      dueDate: data.dueDate || null,
      exchangeItems: data.exchangeItems,
      emiMonths: data.emiMonths,
      interestRate: data.interestRate,
      downPayment: data.downPayment,
      monthlyAmount: data.monthlyAmount,
    }, session.user.storeId, session.user.id);

    const response = NextResponse.json(sale, {
      headers: { "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Reset": String(resetAt) },
    });

    if (idempotencyKey) {
      await completeIdempotencyKey(idempotencyKey, session.user.storeId, sale);
    }

    logger.info("Sale created", { storeId: session.user.storeId, userId: session.user.id, saleId: sale?.id });
    return response;
  } catch (error: any) {
    logger.error("Sale creation failed", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: error.message || "Failed to process sale" }, { status: 500 });
  }
}
