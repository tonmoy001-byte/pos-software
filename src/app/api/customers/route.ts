export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/services";
import { z } from "zod";
import type { Role } from "@prisma/client";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(5, "Valid phone number is required"),
  address: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "customer:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";

  const customers = await prisma.customer.findMany({
    where: {
      storeId: session.user.storeId,
      OR: [
        { name: { contains: query } },
        { phone: { contains: query } }
      ]
    },
    take: 10
  });

  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "customer:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const result = customerSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: result.error.format()
      }, { status: 400 });
    }

    const { name, phone, address } = result.data;

    const customer = await prisma.customer.upsert({
      where: { phone_storeId: { phone, storeId: session.user.storeId } },
      update: { name, address },
      create: {
        name,
        phone,
        address: address || null,
        storeId: session.user.storeId
      }
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customer POST error:", error);
    return NextResponse.json({ error: "Failed to save customer" }, { status: 500 });
  }
}
