import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

async function isSuperAdmin() {
  const session = await getServerSession(authOptions);
  const SUPER_ADMIN_IDS = (process.env.SUPER_ADMIN_IDS || "").split(",");
  return session?.user && SUPER_ADMIN_IDS.includes(session.user.id);
}

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenants = await prisma.store.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Fetch tenants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, status } = await req.json();

    const tenant = await prisma.store.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Update tenant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
