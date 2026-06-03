import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).toLowerCase(),
  password: z.string().min(6),
  storeName: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, username, password, storeName } = signupSchema.parse(body);

    // Check if store name exists (SaaS global check or per-tenant?
    // Usually store names should be unique for subdomains)
    const existingStore = await prisma.store.findFirst({
      where: { name: storeName },
    });

    if (existingStore) {
      return NextResponse.json(
        { error: "Store name already taken" },
        { status: 400 }
      );
    }

    // Check if username is taken globally (since we don't have storeId yet)
    const existingUser = await prisma.user.findFirst({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);

    // Create Store and User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: storeName,
          status: "PENDING", // Requires admin approval
          onboardingComplete: false,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          username,
          password: hashedPassword,
          role: "ADMIN",
          storeId: store.id,
        },
      });

      return { store, user };
    });

    return NextResponse.json({
      message: "Registration successful. Please wait for approval.",
      userId: result.user.id,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
