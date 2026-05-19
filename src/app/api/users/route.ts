export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { hasPermission, logger } from "@/lib/services";
import type { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.user.role as Role, "user:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { storeId: session.user.storeId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true
    }
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.user.role as Role, "user:create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { username, password, name, role } = await req.json();

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: (role as Role) || "CASHIER",
        storeId: session.user.storeId
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true
      }
    });

    return NextResponse.json(user);
  } catch (error: any) {
    logger.error("Failed to create user", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}


