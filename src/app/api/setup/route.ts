import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Basic protection: only allow setup if there are no users,
    // or if a secret setup key is provided in headers
    const userCount = await prisma.user.count();
    const setupKey = req.headers.get("x-setup-key");
    const masterKey = process.env.SETUP_MASTER_KEY || "dinex-master-setup-2025";

    if (userCount > 0 && setupKey !== masterKey) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
    }

    const { name, username, password } = await req.json();

    const hashedPassword = await hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      // Create a System Store for the Super Admin
      // Find by name since it's a known system store
      let systemStore = await tx.store.findFirst({
        where: { name: "System Administration" }
      });

      if (!systemStore) {
        systemStore = await tx.store.create({
          data: {
            name: "System Administration",
            status: "ACTIVE",
            onboardingComplete: true,
            businessType: "SYSTEM",
          },
        });
      }

      const user = await tx.user.create({
        data: {
          name,
          username,
          password: hashedPassword,
          role: "ADMIN",
          storeId: systemStore.id,
        },
      });

      return user;
    });

    return NextResponse.json({
      message: "Super Admin created successfully",
      id: result.id,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
