export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, eventStore, EventStoreData, logger } from "@/lib/services";
import { canWrite } from "@/lib/services/trialGuard";
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
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const dueStatus = searchParams.get("dueStatus") || "all";
  const statsOnly = searchParams.get("stats") === "true";

  const skip = (page - 1) * limit;

  const where: any = { storeId: session.user.storeId, deletedAt: null };

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } }
    ];
  }

  if (dueStatus === "due") {
    where.dueAmount = { gt: 0 };
  } else if (dueStatus === "nodue") {
    where.dueAmount = 0;
  }

  try {
    if (statsOnly) {
      const [total, withDue, totalDueAgg] = await Promise.all([
        prisma.customer.count({ where: { storeId: session.user.storeId, deletedAt: null } }),
        prisma.customer.count({ where: { storeId: session.user.storeId, deletedAt: null, dueAmount: { gt: 0 } } }),
        prisma.customer.aggregate({
          where: { storeId: session.user.storeId, deletedAt: null },
          _sum: { dueAmount: true }
        }),
      ]);

      return NextResponse.json({
        totalCustomers: total,
        customersWithDue: withDue,
        totalDue: Number(totalDueAgg._sum.dueAmount || 0),
      });
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sales: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      data: customers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    logger.error("Failed to fetch customers", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as Role, "customer:create")) {
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
    const result = customerSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: result.error.format()
      }, { status: 400 });
    }

    const { name, phone, address } = result.data;

    try {
      const customer = await prisma.customer.create({
        data: {
          name,
          phone,
          address: address || null,
          storeId: session.user.storeId
        }
      });

      await eventStore.append({
        aggregateType: "Customer",
        aggregateId: customer.id,
        type: "CREATED",
        payload: { name: customer.name, phone: customer.phone },
        userId: session.user.id,
        storeId: session.user.storeId,
      });

      return NextResponse.json(customer);
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json(
          { error: "A customer with this phone number already exists" },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    logger.error("Failed to save customer", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to save customer" }, { status: 500 });
  }
}
