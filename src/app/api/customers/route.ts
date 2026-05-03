export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  try {
    const { name, phone, address } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and Phone are required" }, { status: 400 });
    }

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: { name, address },
      create: {
        name,
        phone,
        address,
        storeId: session.user.storeId
      }
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save customer" }, { status: 500 });
  }
}
