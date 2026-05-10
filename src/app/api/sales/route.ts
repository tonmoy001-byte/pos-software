export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SaleService, hasPermission } from "@/lib/services";
import { z } from "zod";
import type { Role } from "@prisma/client";

const saleService = new SaleService();

const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  price: z.number().nonnegative("Price cannot be negative"),
  cost: z.number().nonnegative().optional(),
  imeis: z.array(z.string()).optional(),
});

const saleCreateSchema = z.object({
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  customerId: z.string().nullable().optional(),
  totalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  dueAmount: z.number().nonnegative(),
  paymentMethod: z.string().optional().default("CASH"),
  discount: z.number().nonnegative().optional().default(0),
  saleType: z.string().optional().default("REGULAR"),
  deliveryDate: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "sale:view")) {
    return NextResponse.json({ error: "Forbidden: Missing sale:view permission" }, { status: 403 });
  }

  try {
    const storeId = session.user.storeId;
    const sales = await saleService.findAll(storeId);
    
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

    return NextResponse.json(formattedSales);
  } catch (error) {
    console.error("GET /api/sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "sale:create")) {
    return NextResponse.json({ error: "Forbidden: Missing sale:create permission" }, { status: 403 });
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
      deliveryDate: data.deliveryDate
    }, session.user.storeId, session.user.id);

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("Sale error:", error);
    return NextResponse.json({ error: error.message || "Failed to process sale" }, { status: 500 });
  }
}
