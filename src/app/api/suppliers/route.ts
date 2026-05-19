export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SupplierService, hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";
import { z } from "zod";

const supplierCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  newProducts: z.array(z.string()).optional(),
});

const supplierService = new SupplierService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "supplier:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const suppliers = await supplierService.findAll(session.user.storeId);
    return NextResponse.json(suppliers || []);
  } catch (error: any) {
    logger.error("Suppliers fetch error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await getSession();
  } catch (e) {
    session = null;
  }
  
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "supplier:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const result = supplierCreateSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: result.error.format()
      }, { status: 400 });
    }

    const data = result.data;

    const supplier = await supplierService.create(data, session.user.storeId);
    
    if (data.productIds || data.newProducts) {
      await supplierService.addProducts(supplier.id, {
        productIds: data.productIds,
        newProducts: data.newProducts,
      }, session.user.storeId);
    }
    
    return NextResponse.json(supplier);
  } catch (error: any) {
    logger.error("Supplier creation error", { storeId: session.user.storeId, userId: session.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}